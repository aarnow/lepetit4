tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                mono:    ['"JetBrains Mono"', 'monospace'],
                display: ['"Syne"', 'sans-serif'],
            },
            colors: {
                p4: {
                    bg:       '#f5f5f4',
                    surface:  '#ffffff',
                    border:   '#e2e0dc',
                    border2:  '#c8c5bf',
                    red:      '#dc2626',
                    'red-lt': '#fee2e2',
                    blue:     '#2563eb',
                    'blue-lt':'#dbeafe',
                    text:     '#1c1917',
                    text2:    '#57534e',
                    muted:    '#a8a29e',
                },
            },
            keyframes: {
                drop: {
                    '0%':   { transform: 'translateY(-200px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)',      opacity: '1' },
                },
                winPulse: {
                    '0%':   { transform: 'scale(1)',    opacity: '1'    },
                    '100%': { transform: 'scale(1.1)',  opacity: '0.8'  },
                },
                fadeIn: {
                    '0%':   { opacity: '0', transform: 'translateY(6px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)'   },
                },
                // Popup P2P
                slideDown: {
                    '0%':   { opacity: '0', transform: 'translate(-50%, -60%)' },
                    '100%': { opacity: '1', transform: 'translate(-50%, -50%)' },
                },
                slideUp: {
                    '0%':   { opacity: '1', transform: 'translate(-50%, -50%)' },
                    '100%': { opacity: '0', transform: 'translate(-50%, -60%)' },
                },
            },
            animation: {
                'drop':       'drop 0.28s cubic-bezier(0.4,0,0.2,1)',
                'win-pulse':  'winPulse 0.55s ease-in-out infinite alternate',
                'fade-in':    'fadeIn 0.25s ease',
                'slide-down': 'slideDown 0.2s ease forwards',
                'slide-up':   'slideUp 0.18s ease forwards',
            },
        },
    },
};