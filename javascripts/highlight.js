document$.subscribe(() => {
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block)
    })
})