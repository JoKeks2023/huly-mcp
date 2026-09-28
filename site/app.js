// huly-mcp-selfhost — project site. Vanilla JS, no dependencies.
// Quick-setup snippets mirror the README's "Compatible Clients" section exactly
// (Huly Cloud variant); the self-hosted variant only adds the two URL variables.

(function () {
  'use strict'

  var PKG = 'huly-mcp-selfhost'

  function env (selfHosted) {
    var vars = [
      ['HULY_EMAIL', 'you@example.com'],
      ['HULY_PASSWORD', 'your-password']
    ]
    if (selfHosted) {
      vars.push(['HULY_ACCOUNTS_URL', 'https://your-huly-instance.com/_accounts'])
      vars.push(['HULY_FRONT_URL', 'https://your-huly-instance.com'])
    }
    return vars
  }

  function jsonEnv (vars, indent) {
    return vars.map(function (v, i) {
      return indent + '"' + v[0] + '": "' + v[1] + '"' + (i < vars.length - 1 ? ',' : '')
    }).join('\n')
  }

  var CLIENTS = {
    'claude-code': {
      name: 'Claude Code',
      file: 'terminal',
      note: 'Add --scope user (all projects) or --scope project (.mcp.json — don’t commit secrets) after “add huly”. Check with: claude mcp list',
      render: function (vars) {
        return 'claude mcp add huly \\\n' +
          vars.map(function (v) { return '  -e ' + v[0] + '=' + v[1] + ' \\' }).join('\n') + '\n' +
          '  -- npx -y ' + PKG
      }
    },
    'claude-desktop': {
      name: 'Claude Desktop',
      file: '~/Library/Application Support/Claude/claude_desktop_config.json',
      note: 'Windows: %APPDATA%\\Claude\\claude_desktop_config.json — restart Claude Desktop after saving.',
      render: function (vars) {
        return '{\n' +
          '  "mcpServers": {\n' +
          '    "huly": {\n' +
          '      "command": "npx",\n' +
          '      "args": ["-y", "' + PKG + '"],\n' +
          '      "env": {\n' +
          jsonEnv(vars, '        ') + '\n' +
          '      }\n' +
          '    }\n' +
          '  }\n' +
          '}'
      }
    },
    codex: {
      name: 'Codex',
      file: '~/.codex/config.toml',
      note: 'Or from the terminal: codex mcp add huly --env HULY_EMAIL=… --env HULY_PASSWORD=… -- npx -y ' + PKG,
      render: function (vars) {
        return '[mcp_servers.huly]\n' +
          'command = "npx"\n' +
          'args = ["-y", "' + PKG + '"]\n' +
          'env = { ' + vars.map(function (v) { return v[0] + ' = "' + v[1] + '"' }).join(', ') + ' }'
      }
    },
    cursor: {
      name: 'Cursor',
      file: '~/.cursor/mcp.json',
      note: 'Or .cursor/mcp.json inside a project. The tools appear in the Agent panel under MCP.',
      render: function (vars) {
        return CLIENTS['claude-desktop'].render(vars)
      }
    },
    zed: {
      name: 'Zed',
      file: '~/.config/zed/settings.json',
      note: 'Merge into your existing settings.json.',
      render: function (vars) {
        return '{\n' +
          '  "context_servers": {\n' +
          '    "huly": {\n' +
          '      "source": "custom",\n' +
          '      "command": "npx",\n' +
          '      "args": ["-y", "' + PKG + '"],\n' +
          '      "env": {\n' +
          jsonEnv(vars, '        ') + '\n' +
          '      }\n' +
          '    }\n' +
          '  }\n' +
          '}'
      }
    }
  }

  // ── storage (per-viewer convenience only; never required) ────────────────
  function load (key) { try { return window.localStorage.getItem(key) } catch (e) { return null } }
  function save (key, value) { try { window.localStorage.setItem(key, value) } catch (e) { /* ignore */ } }

  // ── Quick setup ──────────────────────────────────────────────────────────
  var setup = document.getElementById('setup-panel')
  if (setup) {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"][data-client]'))
    var modeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-mode]'))
    var code = document.getElementById('setup-code')
    var file = document.getElementById('setup-file')
    var note = document.getElementById('setup-note')
    var state = {
      client: CLIENTS[load('huly-site-client')] ? load('huly-site-client') : 'claude-code',
      selfHosted: load('huly-site-mode') === 'self-hosted'
    }

    function render () {
      var c = CLIENTS[state.client]
      code.textContent = c.render(env(state.selfHosted))
      file.textContent = c.file
      note.textContent = c.note
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-client') === state.client
        t.setAttribute('aria-selected', on ? 'true' : 'false')
        t.tabIndex = on ? 0 : -1
        if (on) setup.setAttribute('aria-labelledby', t.id)
      })
      modeButtons.forEach(function (b) {
        b.setAttribute('aria-pressed', (b.getAttribute('data-mode') === 'self-hosted') === state.selfHosted ? 'true' : 'false')
      })
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        state.client = t.getAttribute('data-client')
        save('huly-site-client', state.client)
        render()
      })
      t.addEventListener('keydown', function (e) {
        var next = null
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length]
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length]
        else if (e.key === 'Home') next = tabs[0]
        else if (e.key === 'End') next = tabs[tabs.length - 1]
        if (next) { e.preventDefault(); next.focus(); next.click() }
      })
    })

    modeButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        state.selfHosted = b.getAttribute('data-mode') === 'self-hosted'
        save('huly-site-mode', state.selfHosted ? 'self-hosted' : 'cloud')
        render()
      })
    })

    render()
  }

  // ── Copy buttons ─────────────────────────────────────────────────────────
  function fallbackCopy (text) {
    var ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    var ok = false
    try { ok = document.execCommand('copy') } catch (e) { ok = false }
    document.body.removeChild(ta)
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'))
  }

  function copyText (text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text) })
    }
    return fallbackCopy(text)
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    var label = btn.querySelector('.copy-label')
    var timer = null
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy'))
      if (!target) return
      copyText(target.textContent).then(function () {
        btn.setAttribute('data-state', 'copied')
        label.textContent = 'Copied'
      }, function () {
        btn.setAttribute('data-state', 'failed')
        label.textContent = 'Press ⌘/Ctrl+C'
      }).then(function () {
        clearTimeout(timer)
        timer = setTimeout(function () {
          btn.removeAttribute('data-state')
          label.textContent = 'Copy'
        }, 1600)
      })
    })
  })

  // ── Theme ────────────────────────────────────────────────────────────────
  var root = document.documentElement
  var toggle = document.getElementById('theme-toggle')
  var stored = load('huly-site-theme')
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored)

  function currentTheme () {
    var explicit = root.getAttribute('data-theme')
    if (explicit) return explicit
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  if (toggle) {
    var sync = function () { toggle.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') }
    sync()
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark'
      root.setAttribute('data-theme', next)
      save('huly-site-theme', next)
      sync()
    })
  }
})()
