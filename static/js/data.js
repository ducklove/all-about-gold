/* A finance-pi API locally, its published snapshot on GitHub Pages. */
(function(root) {
  let pending;
  const endpoint = document.querySelector('meta[name="gold-data-url"]').content;
  root.GoldData = {
    load() {
      if (!pending) pending = fetch(endpoint, {cache:'no-store'}).then(async response => {
        if (!response.ok) throw Error('finance-pi snapshot unavailable');
        const data = await response.json();
        if (data.provider !== 'finance-pi' || data.schemaVersion !== 1 || !data.history || !data.trends || !data.research) throw Error('Invalid finance-pi snapshot');
        return data;
      }).catch(error => { pending = null; throw error; });
      return pending;
    }
  };
})(window);
