let authPollTimer = null
let authPollKey = ''

const REQUIRED_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-private',
]

function missingScopes(granted) {
  if (!granted) return []
  const values = String(granted).split(/\s+/).filter(Boolean)
  return REQUIRED_SCOPES.filter((scope) => values.indexOf(scope) < 0)
}

function stopAuthPolling() {
  if (authPollTimer) clearInterval(authPollTimer)
  authPollTimer = null
  authPollKey = ''
}

AppSettingsPage({
  build(props) {
    const cid = props.settingsStorage.getItem('spotifyClientId') || ''
    const at = props.settingsStorage.getItem('spotifyAccessToken') || props.settingsStorage.getItem('spotifyToken') || ''
    const rt = props.settingsStorage.getItem('spotifyRefreshToken') || ''
    const exp = parseInt(props.settingsStorage.getItem('spotifyExpiresAt') || '0', 10)
    const grantedScopes = props.settingsStorage.getItem('spotifyScopes') || ''
    const missing = missingScopes(grantedScopes)
    const needsReconnect = props.settingsStorage.getItem('spotifyNeedsReconnect') === '1' || missing.length > 0
    const hasAt = at && at.length > 20
    const isExp = exp ? Date.now() > exp - 60000 : false
    const status = !hasAt ? 'NOT LOGGED IN' : needsReconnect ? 'RECONNECT REQUIRED' : isExp ? 'EXPIRED' : 'LOGGED IN ✓'
    const col = !hasAt || needsReconnect ? '#d32f2f' : isExp ? '#ff9800' : '#0a7d2e'
    const DEFAULT_CID = '4454bd0035e849b886a23a1017e217a0'
    const useCid = cid || DEFAULT_CID
    // Default = working public alias. Normalize user input: trim, strip trailing slashes and /api/callback, force https
    const rawServer = props.settingsStorage.getItem('spotifyAuthServer') || 'https://spotify-auth-server-nu.vercel.app'
    let serverUrl = String(rawServer).trim()
    serverUrl = serverUrl.replace(/\/+$/, '')
    serverUrl = serverUrl.replace(/\/api\/callback$/, '')
    if (!/^https?:\/\//.test(serverUrl)) serverUrl = 'https://' + serverUrl
    serverUrl = serverUrl.replace(/^http:/, 'https:')
    const redirect = `${serverUrl}/api/callback`
    const scope = REQUIRED_SCOPES.join(' ')
    const verifier = props.settingsStorage.getItem('spotifyCodeVerifier') || ''
    const challenge = props.settingsStorage.getItem('spotifyCodeChallenge') || ''
    const authState = props.settingsStorage.getItem('spotifyAuthState') || ''
    const exchangeStatus = props.settingsStorage.getItem('spotifyExchangeStatus') || ''

    const authUrl = verifier && challenge && authState && useCid
      ? `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(useCid)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scope)}&code_challenge_method=S256&code_challenge=${encodeURIComponent(challenge)}&state=${encodeURIComponent(authState)}&show_dialog=true`
      : ''

    // Pure-JS SHA-256 (no crypto.subtle/TextEncoder - they crash in Zepp settings webview)
    function sha256Bytes(ascii) {
      const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
      let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
      const l = ascii.length
      const withOne = ((l + 8) >> 6) + 1
      const words = new Array(withOne * 16).fill(0)
      for (let i = 0; i < l; i++) words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8)
      words[l >> 2] |= 0x80 << (24 - (l % 4) * 8)
      words[withOne * 16 - 1] = l * 8
      const rr = (x, n) => (x >>> n) | (x << (32 - n))
      for (let j = 0; j < withOne; j++) {
        const w = new Array(64)
        for (let i = 0; i < 16; i++) w[i] = words[j * 16 + i]
        for (let i = 16; i < 64; i++) {
          const s0 = rr(w[i-15],7) ^ rr(w[i-15],18) ^ (w[i-15] >>> 3)
          const s1 = rr(w[i-2],17) ^ rr(w[i-2],19) ^ (w[i-2] >>> 10)
          w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0
        }
        let [a,b,c,d,e,f,g,h] = H
        for (let i = 0; i < 64; i++) {
          const S1 = rr(e,6) ^ rr(e,11) ^ rr(e,25)
          const ch = (e & f) ^ (~e & g)
          const t1 = (h + S1 + ch + K[i] + w[i]) | 0
          const S0 = rr(a,2) ^ rr(a,13) ^ rr(a,22)
          const mj = (a & b) ^ (a & c) ^ (b & c)
          const t2 = (S0 + mj) | 0
          h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
        }
        H = [(H[0]+a)|0,(H[1]+b)|0,(H[2]+c)|0,(H[3]+d)|0,(H[4]+e)|0,(H[5]+f)|0,(H[6]+g)|0,(H[7]+h)|0]
      }
      const out = []
      for (let i = 0; i < 8; i++) for (let s = 3; s >= 0; s--) out.push((H[i] >>> (s * 8)) & 0xff)
      return out
    }
    function b64urlFromBytes(bytes) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
      let out = ''
      for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i], b1 = bytes[i+1] ?? 0, b2 = bytes[i+2] ?? 0
        out += chars[b0 >> 2]
        out += chars[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
        if (bytes[i+1] !== undefined) out += chars[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
        if (bytes[i+2] !== undefined) out += chars[b2 & 63]
      }
      return out
    }
    function b64urlStr(str) {
      const bytes = []
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)
        if (code < 128) bytes.push(code)
        else if (code < 2048) { bytes.push(192 | (code >> 6), 128 | (code & 63)) }
        else { bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63)) }
      }
      return b64urlFromBytes(bytes)
    }

    const startPolling = (state) => {
      if (!state) return
      if (authPollTimer && authPollKey === state) return
      stopAuthPolling()
      authPollKey = state
      let tries = 0
      const maxTries = 90 // 3min
      const poll = () => {
        tries++
        if (tries > maxTries) {
          stopAuthPolling()
          props.settingsStorage.setItem('spotifyPollKey', '')
          props.settingsStorage.setItem('spotifyExchangeStatus', 'Timeout - Prepare + Login again')
          return
        }
        fetch(`${serverUrl}/api/poll?state=${encodeURIComponent(state)}`)
          .then((r) => r.json())
          .then((j) => {
            if (j.status === 'ok' && j.access_token) {
              stopAuthPolling()
              const newScopes = String(j.scope || '').trim()
              const missingNewScopes = missingScopes(newScopes)
              props.settingsStorage.setItem('spotifyAccessToken', j.access_token)
              props.settingsStorage.setItem('spotifyToken', j.access_token)
              if (j.refresh_token) props.settingsStorage.setItem('spotifyRefreshToken', j.refresh_token)
              props.settingsStorage.setItem('spotifyScopes', newScopes)
              props.settingsStorage.setItem('spotifyNeedsReconnect', missingNewScopes.length ? '1' : '')
              const expAt = Date.now() + (j.expires_in || 3600) * 1000
              props.settingsStorage.setItem('spotifyExpiresAt', String(expAt))
              props.settingsStorage.setItem('spotifyPollKey', '')
              props.settingsStorage.setItem('spotifyAuthState', '')
              props.settingsStorage.setItem('spotifyCodeVerifier', '')
              props.settingsStorage.setItem('spotifyCodeChallenge', '')
              props.settingsStorage.setItem(
                'spotifyExchangeStatus',
                missingNewScopes.length
                  ? `Login incomplete - missing: ${missingNewScopes.join(', ')}`
                  : `✓ Logged in with auto-refresh ${j.refresh_token ? 'enabled' : 'unavailable'}`,
              )
            } else if (j.status === 'error') {
              stopAuthPolling()
              props.settingsStorage.setItem('spotifyPollKey', '')
              props.settingsStorage.setItem('spotifyExchangeStatus', `Error: ${j.error} ${j.desc || ''}`)
            } else {
              props.settingsStorage.setItem('spotifyExchangeStatus', `Waiting for Spotify... (${tries * 2}s)`)
            }
          })
          .catch((e) => {
            if (tries % 5 === 0) props.settingsStorage.setItem('spotifyExchangeStatus', `Poll err: ${e.message || e}`)
          })
      }
      authPollTimer = setInterval(poll, 2000)
      poll()
    }

    // Resume polling if a login is pending (user returned from browser after interval died)
    const savedPollKey = props.settingsStorage.getItem('spotifyPollKey') || ''
    if (!hasAt && savedPollKey) {
      startPolling(savedPollKey)
    }

    return View({ style: { padding: '16px', alignItems: 'center' } }, [
      Text({ bold: true, style: { fontSize: '20px', textAlign: 'center' } }, 'Spotify for Bip 6'),
      Text({ style: { color: col, fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginTop: '8px' } }, status),
      hasAt ? Text({ style: { color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '4px' } }, `Token ${at.substring(0, 10)}...`) : null,
      hasAt && rt ? Text({ style: { color: '#0a7d2e', fontSize: '12px', textAlign: 'center' } }, 'Auto-refresh ✓') : null,
      hasAt && needsReconnect ? Text({ style: { color: '#d32f2f', fontSize: '13px', textAlign: 'center', marginTop: '8px', lineHeight: '18px' } }, 'Spotify did not grant every permission. Tap Clear login below, then Prepare and Login again. Approve the Spotify permission screen.') : null,

      Section({ style: { marginTop: '16px', width: '100%', background: '#eefbf2', borderRadius: '12px', padding: '14px', alignItems: 'center' } }, [
        Text({ bold: true, style: { fontSize: '15px', textAlign: 'center' } }, 'Phone-wide volume'),
        Text({ style: { color: '#35523e', fontSize: '12px', textAlign: 'center', marginTop: '6px', lineHeight: '17px' } }, 'Tap Volume on the watch to open the Bip 6 Music controller. It controls the active phone media session over Bluetooth, not Spotify volume.'),
        Text({ style: { color: '#555', fontSize: '11px', textAlign: 'center', marginTop: '6px', lineHeight: '15px' } }, 'Android: grant Zepp notification access and keep Zepp running in the background. Keep Bluetooth connected on Android or iPhone.'),
      ]),

      Section({ style: { marginTop: '20px', width: '100%', background: '#fff', borderRadius: '12px', padding: '16px', alignItems: 'center' } }, [
        Text({ bold: true, style: { fontSize: '16px', textAlign: 'center' } }, 'Automatic login (recommended)'),
        Text({ style: { color: '#555', fontSize: '14px', textAlign: 'center', marginTop: '8px', lineHeight: '20px' } }, '1 tap Prepare, 1 tap Login, approve on Spotify, return here - auto done. No copy-paste.'),
        Text({ style: { color: '#888', fontSize: '11px', textAlign: 'center', marginTop: '4px' } }, `Server: ${serverUrl}`),
        View({ style: { marginTop: '12px', width: '100%', flexDirection: 'row' } }, [
          Button({
            label: '1) Prepare',
            style: { flex: 1, marginRight: '6px' },
            onClick: () => {
              try {
                stopAuthPolling()
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
                let v = '', n = ''
                for (let i = 0; i < 64; i++) v += chars.charAt(Math.floor(Math.random() * chars.length))
                for (let i = 0; i < 16; i++) n += chars.charAt(Math.floor(Math.random() * chars.length))
                props.settingsStorage.setItem('spotifyExchangeStatus', 'Generating...')
                const cidToUse = props.settingsStorage.getItem('spotifyClientId') || DEFAULT_CID
                // S256 challenge - pure JS, synchronous
                const hashBytes = sha256Bytes(v)
                const ch = b64urlFromBytes(hashBytes)
                // Packed state: verifier+clientId+redirect travel inside state (stateless callback)
                const packed = b64urlStr(JSON.stringify({ v, c: cidToUse, r: redirect, n }))
                props.settingsStorage.setItem('spotifyCodeVerifier', v)
                props.settingsStorage.setItem('spotifyCodeChallenge', ch)
                props.settingsStorage.setItem('spotifyAuthState', packed)
                props.settingsStorage.setItem('spotifyPollKey', n)
                props.settingsStorage.setItem('spotifyExchangeStatus', 'Ready - tap Login')
                startPolling(n)
              } catch (e) {
                props.settingsStorage.setItem('spotifyExchangeStatus', `Prepare error: ${e.message || e}`)
              }
            },
          }),
          View({ style: { flex: 1 } }, authUrl ? Link({ source: authUrl }, '2) Login') : Text({ style: { color: '#888', fontSize: '12px', textAlign: 'center', marginTop: '8px' } }, 'Tap Prepare first')),
        ]),
        Text({ style: { color: exchangeStatus.startsWith('✓') ? '#0a7d2e' : '#888', fontSize: '12px', textAlign: 'center', marginTop: '8px', lineHeight: '16px' } }, exchangeStatus || 'After Login, return here - auto detects in 2s'),
        authUrl ? Text({ style: { color: '#888', fontSize: '10px', textAlign: 'center', marginTop: '4px' } }, `State: ${authState.substring(0, 8)}...`) : null,
      ]),

      Section({ style: { marginTop: '16px', width: '100%', background: '#f5f5f5', borderRadius: '12px', padding: '12px', alignItems: 'center' } }, [
        Text({ bold: true, style: { fontSize: '13px', textAlign: 'center' } }, 'Manual fallback (if auto fails)'),
        Text({ style: { color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '4px', lineHeight: '16px' } }, 'Copy code=... from browser and paste:'),
        TextInput({ label: 'Paste code (AQ...)', placeholder: 'AQ...', settingsKey: 'spotifyAuthCode', subStyle: { marginTop: '8px', textAlign: 'center' } }),
        Button({
          label: 'Exchange pasted code',
          style: { marginTop: '8px' },
          onClick: () => {
            const code = props.settingsStorage.getItem('spotifyAuthCode') || ''
            const cid2 = props.settingsStorage.getItem('spotifyClientId') || DEFAULT_CID
            const ver2 = props.settingsStorage.getItem('spotifyCodeVerifier') || ''
            if (!code || !cid2 || !ver2) { props.settingsStorage.setItem('spotifyExchangeStatus', 'Need code + Prepare first'); return }
            const body = new URLSearchParams({ client_id: cid2, grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: ver2 }).toString()
            fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
              .then((r) => r.json().then((j) => ({ s: r.status, j })))
              .then(({ s, j }) => {
                if (s >= 400) { props.settingsStorage.setItem('spotifyExchangeStatus', `Error ${s}: ${j.error}`); return }
                props.settingsStorage.setItem('spotifyAccessToken', j.access_token)
                props.settingsStorage.setItem('spotifyToken', j.access_token)
                if (j.refresh_token) props.settingsStorage.setItem('spotifyRefreshToken', j.refresh_token)
                const newScopes = String(j.scope || '').trim()
                const missingNewScopes = missingScopes(newScopes)
                props.settingsStorage.setItem('spotifyScopes', newScopes)
                props.settingsStorage.setItem('spotifyNeedsReconnect', missingNewScopes.length ? '1' : '')
                props.settingsStorage.setItem('spotifyExpiresAt', String(Date.now() + (j.expires_in || 3600) * 1000))
                props.settingsStorage.setItem(
                  'spotifyExchangeStatus',
                  missingNewScopes.length
                    ? `Login incomplete - missing: ${missingNewScopes.join(', ')}`
                    : `✓ Logged in; ${REQUIRED_SCOPES.length} permissions granted`,
                )
              })
          },
        }),
        Text({ style: { color: '#888', fontSize: '11px', textAlign: 'center', marginTop: '6px' } }, 'Or paste BQ directly:'),
        TextInput({ label: 'Paste BQ token', placeholder: 'BQ...', settingsKey: 'spotifyAccessToken', subStyle: { marginTop: '6px', textAlign: 'center' } }),
      ]),

      Section({ style: { marginTop: '16px', width: '100%', background: '#fff', borderRadius: '12px', padding: '12px', alignItems: 'center' } }, [
        Text({ bold: true, style: { fontSize: '13px', textAlign: 'center' } }, 'Client ID & Server'),
        Link({ source: 'https://developer.spotify.com/dashboard' }, 'Create Spotify App'),
        Text({ style: { color: '#555', fontSize: '11px', textAlign: 'center', marginTop: '6px', lineHeight: '14px' } }, 'Redirect URIs must include:'),
        Text({ style: { color: '#0a7d2e', fontSize: '11px', textAlign: 'center' } }, redirect),
        TextInput({ label: 'Client ID', placeholder: 'abc...', settingsKey: 'spotifyClientId', subStyle: { marginTop: '8px', textAlign: 'center' } }),
        TextInput({ label: 'Auth server URL', placeholder: serverUrl, settingsKey: 'spotifyAuthServer', subStyle: { marginTop: '8px', textAlign: 'center' } }),
      ]),

      View({ style: { marginTop: '16px', width: '100%', alignItems: 'center' } }, [
        Button({ label: 'Clear login', onClick: () => {
          stopAuthPolling()
          props.settingsStorage.setItem('spotifyAccessToken','')
          props.settingsStorage.setItem('spotifyToken','')
          props.settingsStorage.setItem('spotifyRefreshToken','')
          props.settingsStorage.setItem('spotifyExpiresAt','')
          props.settingsStorage.setItem('spotifyScopes','')
          props.settingsStorage.setItem('spotifyNeedsReconnect','')
          props.settingsStorage.setItem('spotifyPollKey','')
          props.settingsStorage.setItem('spotifyAuthState','')
          props.settingsStorage.setItem('spotifyCodeVerifier','')
          props.settingsStorage.setItem('spotifyCodeChallenge','')
          props.settingsStorage.setItem('spotifyExchangeStatus','Logged out')
        }}),
      ]),
    ])
  },
})
