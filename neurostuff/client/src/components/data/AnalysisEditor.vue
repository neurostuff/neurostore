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
export default {
  data() {
    return {
      schema: {
        fields: [{
          type: "input",
          inputType: "text",
          label: "Name",
          model: "name",
          // readonly: true,
          featured: true,
          styleClasses: "title",
        }, {
          type: "input",
          inputType: "text",
          label: "Description",
          model: "description",
          // readonly: true,
        }, {
          type: "input",
          inputType: "text",
          label: "Publication",
          model: "publication",
          // readonly: true,
        }, {
          type: "input",
          inputType: "text",
          label: "DOI",
          model: "doi",
          // readonly: true,
        }, {
          type: "textArea",
          label: "Metadata",
          model: "metadata",
          rows: 10
        }, {
          type: "submit",
          buttonText: "Save",
          onSubmit: this.saveModel,
        }
        ],
      },
    };
  },
  computed: {
    model() { return this.$store.state.data.active; },
  },
  methods: {
  },
};
</script>
