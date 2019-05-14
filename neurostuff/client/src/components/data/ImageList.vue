<template>
  <b-container>
    <h3>Neurosynth Images</h3>
    <b-row>
      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="All fields:" class="mb-0">
            <b-form-input v-model="search.search" placeholder="Type to search"></b-form-input>
        </b-form-group>
        <b-form-group label-cols-sm="3" label="Filename/URL:" class="mb-0">
            <b-form-input v-model="search.path" placeholder="Type to search"></b-form-input>
        </b-form-group>
      </b-col>
      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="Image type:" class="mb-0">
            <b-form-input v-model="search.value_type" placeholder="Type to search"></b-form-input>
        </b-form-group>
        <b-form-group label-cols-sm="3" label="Space:" class="mb-0">
            <b-form-input v-model="search.space" placeholder="Type to search"></b-form-input>
        </b-form-group>
        <b-form-group label-cols-sm="3" label="Per page" class="mb-0">
          <b-form-select v-model="perPage" :options="pageOptions"></b-form-select>
        </b-form-group>
      </b-col>
      </b-col>
    </b-row>

    <b-row class="image-table">
      <b-table striped small responsive :items="getItems" :fields="fields"
               primary-key="@id" :per-page="perPage"
               ref="imageTable" :sortBy="sortBy" :sortDesc="sortDesc">
        <template slot="path" slot-scope="data">
          <a :href="`/images/${data.item.id}`">{{mapPath(data.item.path)}}</a>
        </template>
        <template slot="analysis_name" slot-scope="data">
          <a :href="`/analyses/${data.item.analysis}`">{{data.item.analysis_name}}</a>
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
      search: {
          search: null,
          path: null,
          value_type: null,
          space: null,
      },
      fields: [
        {
          key: 'path',
          label: 'Filename',
          sortable: true,
        }, {
          key: 'analysis_name',
          label: 'Analysis',
          sortable: true,
        }, {
          key: 'value_type',
          label: 'Type',
          sortable: true,
        }, {
          key: 'space',
          label: 'Space',
          sortable: true,
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
    getItems: _.debounce(function(ctx) {
      let url = `http://localhost:5000/api/images/?page=${ctx.currentPage}`+
                  `&page_size=${ctx.perPage}`;
      for (const [k, v] of Object.entries(this.search)) {
        if (v != null && v !== '') {
          url += `&${k}=${v}`
        }
      }
      console.log("URL:", url);
      // if (ctx.sortBy !== '') { url += `&sort=${ctx.sortBy}&desc=${ctx.sortDesc | 0}` };
      let promise = axios.get(url)
      return promise.then(res => {
        let items = res.data;
        console.log(items);
        items.forEach((img) => {
          img.id = img['@id'].split('/').pop();
          img.analysis = img['analysis'].split('/').pop();
        });
        return items || [];
      });
    }, 1000, {'leading': true, 'trailing': true}),
    mapPath(path) { return path.split('/').pop(); },
  },
}
</script>
<style>
.min-width-200 {
  min-width: 200px;
}

.image-table {
    margin-top: 15px;
}
</style>