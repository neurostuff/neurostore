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
      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="Per page" class="mb-0">
          <b-form-select v-model="perPage" :options="pageOptions"></b-form-select>
        </b-form-group>
      </b-col>
    </b-row>
    <b-row>
      <b-table striped small responsive :items="getItems" :fields="fields"
               primary-key="@id" :filter="filter" :per-page="perPage"
               ref="studyTable" :sortBy="sortBy" :sortDesc="sortDesc">
        <template slot="name" slot-scope="data">
          <a :href="`/studies/${data.item.id}`">{{data.item.name}}</a>
        </template>
        <template slot="created_at" slot-scope="data">
          {{(new Date(data.item.created_at)).toDateString()}}
        </template>
      </b-table>
    </b-row>
  </b-container>
</template>

<script>
import Vue from 'vue';
import axios from 'axios';
import _ from 'lodash';

export default {
  data() {
    return {
      items: [],
      fields: [
        {
          key: 'name',
          label: 'name',
          sortable: true,
        }, {
          key: 'created_at',
          label: 'date',
          sortable: true,
          class: "min-width-200",
        },
      ],
      filter: null,
      perPage: 20,
      pageOptions: [10, 20, 50, 100],
      sortBy: 'created_at',
      sortDesc: true
    }
  },
  methods: {
    getItems: _.debounce((ctx) => {
      let url = `http://localhost:5000/api/studies/?page=${ctx.currentPage}`+
                  `&page_size=${ctx.perPage}`;
      if (ctx.filter !== '') { url += `&search=${ctx.filter}`};
      if (ctx.sortBy !== '') { url += `&sort=${ctx.sortBy}&desc=${ctx.sortDesc | 0}` };
      let promise = axios.get(url)
      return promise.then(res => {
        let items = res.data;
        items.forEach((study) => {
          study.id = study['@id'].split('/').pop();
        });
        return items || [];
      });
    }, 1000, {'leading': true, 'trailing': true}),
  },
}
</script>
<style>
.min-width-200 {
  min-width: 200px;
}
</style>