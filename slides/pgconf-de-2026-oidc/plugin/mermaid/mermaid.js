window.RevealMermaid = window.RevealMermaid || {
    id: 'mermaid',
    init: function(deck) {
        return new Promise(function(resolve) {
            if (typeof mermaid === 'undefined') {
                console.warn('RevealMermaid: mermaid library not loaded');
                resolve();
                return;
            }

            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose'
            });

            var nodes = document.querySelectorAll('pre code.mermaid, pre code.language-mermaid');
            var jobs = [];
            nodes.forEach(function(code, idx) {
                var pre = code.parentElement;
                var div = document.createElement('div');
                div.className = 'mermaid';
                var src = code.textContent;
                pre.parentNode.replaceChild(div, pre);

                jobs.push(
                    mermaid.render('reveal-mermaid-' + idx, src).then(function(result) {
                        div.innerHTML = result.svg;
                        if (typeof result.bindFunctions === 'function') {
                            result.bindFunctions(div);
                        }
                    }).catch(function(err) {
                        console.error('RevealMermaid render error:', err);
                        div.textContent = src;
                    })
                );
            });

            Promise.all(jobs).then(resolve);
        });
    }
};
