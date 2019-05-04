import axios from 'axios';

export default {

  methods: {
    prettyJSON(json) {
      if (json) {
        json = JSON.stringify(json, undefined, 4);
        json = json.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
          var cls = 'number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'key';
            } else {
              cls = 'string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'boolean';
          } else if (/null/.test(match)) {
            cls = 'null';
          }
          return match;
        });
      }
    },
    getModel() {
      const path = `http://localhost:5000/api/${resource}/${this.$route.params.id}?nested=1`;
      axios.get(path)
        .then((res) => {
          res.data.metadata = this.prettyJSON(res.data.metadata);
          this.model = res.data;
        })
        .catch((error) => {
          console.error(error);
        });
    },
    saveModel() {
      let path;
      let func;
      if (this.$route.params.id === 'new') {
        path = `http://localhost:5000/api/${this.resource}/new`;
        func = axios.post;
      } else {
        path = this.model['@id'].replace('neurostuff.org', 'localhost:5000');
        func = axios.put;
      }
      func(path, this.model)
        .then((res) => {})
        .catch((error) => {
          console.error(error);
        });
    },
  },
  created() {
    this.getModel();
  },
};
