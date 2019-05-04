<template>
  <div class="container" id="form">
    <div class="panel panel-default">
      <div class="panel-body">
        <vue-form-generator :schema="schema" :model="model" :options="formOptions"></vue-form-generator>
      </div>
    </div>
  </div>
</template>

<script>
import Vue from 'vue';
import axios from 'axios';
import VueFormGenerator from 'vue-form-generator';
import 'vue-form-generator/dist/vfg.css';

Vue.use(VueFormGenerator);

export default {
  data() {
    return {
      model: {},
      schema: {
        fields: [{
          type: "input",
          inputType: "text",
          label: "URL",
          model: "path",
          // readonly: true,
          featured: true,
          styleClasses: "title",
        }, {
          type: "input",
          inputType: "text",
          label: "Space",
          model: "space",
          // readonly: true,
        }, {
          type: "input",
          inputType: "text",
          label: "Value type",
          model: "value_type",
          // readonly: true,
        }, {
          type: "input",
          inputType: "text",
          label: "Analysis IRI",
          model: "analysis",
          // readonly: true,
        }, {
          type: "submit",
          buttonText: "Save",
          onSubmit: this.saveModel,
        }
        ],
      },
    };
  },
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
      const path = `http://localhost:5000/api/images/${this.$route.params.id}?nested=1`;
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
      console.log(this.model);
      if (this.$route.params.id == 'new') {
        var path = 'http://localhost:5000/api/images/new';
        var func = axios.post;
      } else {
        var path = this.model['@id'].replace('neurostuff.org', 'localhost:5000');
        var func = axios.put;
      }
      func(path, this.model)
        .then((res) => {})
        .catch((error) => {
          console.error(error);
        });
    }
  },
  created() {
    this.getModel();
  },
};
</script>
