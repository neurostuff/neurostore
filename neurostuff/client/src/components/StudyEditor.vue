<template>
  <vue-form-generator :schema="schema" :model="model" :options="formOptions" />
</template>

<script>

export default {
  props: ['model'],
  data() {
    return {
      schema: {
        fields: [{
          type: "input",
          inputType: "text",
          label: "Title",
          model: "name",
          // readonly: true,
          featured: false,
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
};
</script>
