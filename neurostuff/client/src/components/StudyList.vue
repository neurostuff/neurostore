<template>
  <b-container>
    <h3>Studies in NeuroStuff</h3>
    <b-row>
      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="Filter" class="mb-0">
          <b-input-group>
            <b-form-input v-model="filter" placeholder="Type to Search"></b-form-input>
            <b-input-group-append>
              <b-button :disabled="!filter" @click="filter = ''">Clear</b-button>
            </b-input-group-append>
          </b-input-group>
        </b-form-group>
      </b-col>

      <!-- <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="Sort" class="mb-0">
          <b-input-group>
            <b-form-select v-model="sortBy" :options="sortOptions">
              <option slot="first" :value="null">-- none --</option>
            </b-form-select>
            <b-form-select v-model="sortDesc" :disabled="!sortBy" slot="append">
              <option :value="false">Asc</option> <option :value="true">Desc</option>
            </b-form-select>
          </b-input-group>
        </b-form-group>
      </b-col>

      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="Sort direction" class="mb-0">
          <b-input-group>
            <b-form-select v-model="sortDirection" slot="append">
              <option value="asc">Asc</option> <option value="desc">Desc</option>
              <option value="last">Last</option>
            </b-form-select>
          </b-input-group>
        </b-form-group>
      </b-col> -->

      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="Per page" class="mb-0">
          <b-form-select v-model="perPage" :options="pageOptions"></b-form-select>
        </b-form-group>
      </b-col>
    </b-row>
    <b-row>
      <b-table striped small responsive :items="getItems" :fields="fields"
               primary-key="@id" :filter="filter" :per-page="perPage">
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
      fields: ['name', 'description', 'doi'].map((f) => ({key: f, sortable: true})),
      filter: null,
      perPage: 20,
      pageOptions: [10, 20, 50, 100],
    }
  },
  methods: {
    getItems(ctx) {
      let url = `http://localhost:5000/api/studies/?page=${ctx.currentPage}`+
                  `&page_size=${ctx.perPage}`
      if (ctx.filter !== '') { url += `&search=${ctx.filter}`};
      console.log(url);
      let promise = axios.get(url)
      return promise.then(res => {
        let items = res.data;
        items.forEach((study) => {
          study.id = study['@id'].split('/').pop();
        });
        return items || []
      });
    },
  }
}
</script>