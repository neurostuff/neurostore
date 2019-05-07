<template>
  <div class="container" id="form">
    <div class="panel panel-default">
      <div class="panel-body">
        <vue-form-generator :schema="schema" :model="model"
                            :options="formOptions"></vue-form-generator>
      </div>
    </div>
  </div>
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
  },
};
</script>
