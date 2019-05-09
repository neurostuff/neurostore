<template>
  <b-container>
    <h3>Studies in NeuroStuff</h3>
    <b-row>
      <b-table striped small responsive :items="data" :fields="fields"
               primary-key="@id">
        <template slot="name" slot-scope="data">
          <a :href="`/studies/${data.item.id}`">{{data.item.name}}</a>
        </template>
      </b-table>
    </b-row>
  </b-container>
</template>

<script>
import Vue from 'vue';
import axios from 'axios';

export default {
  data() {
    return {
      data: [],
      fields: ['name', 'description', 'doi'].map((f) => ({key: f, sortable: true})),
      resource: "studies",
    }
  },
  created() {
    this.getResource();
  },
  methods: {
    getResource() {
      const path = `http://localhost:5000/api/studies/`;
      axios.get(path)
        .then((res) => {
          this.data = res.data;
          this.data.forEach((study) => {
            study.id = study['@id'].split('/').pop();
          });
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }
}
</script>