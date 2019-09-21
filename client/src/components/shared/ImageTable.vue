<template>
  <div>
    <b-row>
      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="All fields:" class="mb-0">
            <b-form-input v-model="search.search" placeholder="Type to search"
                          @input="debouncedGetItems">
            </b-form-input>
        </b-form-group>
        <b-form-group label-cols-sm="3" label="Filename/URL:" class="mb-0">
            <b-form-input v-model="search.path" placeholder="Type to search"
                          @input="debouncedGetItems">
            </b-form-input>
        </b-form-group>
      </b-col>
      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="Image type:" class="mb-0">
            <b-form-input v-model="search.value_type" placeholder="Type to search"
                          @input="debouncedGetItems">
            </b-form-input>
        </b-form-group>
        <b-form-group label-cols-sm="3" label="Space:" class="mb-0">
            <b-form-input v-model="search.space" placeholder="Type to search"
                          @input="debouncedGetItems">
            </b-form-input>
        </b-form-group>
        <b-form-group label-cols-sm="3" label="Per page" class="mb-0">
          <b-form-select v-model="perPage" :options="pageOptions"
                        @input="debouncedGetItems"></b-form-select>
        </b-form-group>
      </b-col>
    </b-row>

    <b-row class="image-table">
      <b-table striped small responsive
        primary-key="@id"
        :items="items"
        :fields="fields"
        :per-page="perPage"
        :current-page="currentPage"
        :sortBy="sortBy"
        :sortDesc="sortDesc"
        @sort-changed="getItems">
        <template slot="path" slot-scope="data">
          <a :href="`/images/${data.item.id}`">{{mapPath(data.item.path)}}</a>
        </template>
        <template slot="analysis_name" slot-scope="data">
          <a :href="`/analyses/${data.item.analysis}`">{{data.item.analysis_name}}</a>
        </template>
      </b-table>
    </b-row>

    <b-row>
      <b-col md="6" class="my-1">
        <b-pagination
          v-model="currentPage"
          :total-rows="totalRows"
          :per-page="perPage"
          class="my-0"
        ></b-pagination>
      </b-col>
    </b-row>

  </div>
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
      sortDesc: true,
      currentPage: 1,
      totalRows: null,
    }
  },
  methods: {
    getItems() {
      let url = `http://localhost:5000/api/images/?page=${this.currentPage}`+
                  `&page_size=${this.perPage}`;
      for (const [k, v] of Object.entries(this.search)) {
        if (v != null && v !== '') {
          url += `&${k}=${v}`
        }
      }
      if (this.sortBy !== '') { url += `&sort=${this.sortBy}&desc=${this.sortDesc | 0}` };
      let promise = axios.get(url)
      return promise.then(res => {
        let items = res.data;
        items.forEach((img) => {
          img.id = img['@id'].split('/').pop();
          img.analysis = img['analysis'].split('/').pop();
        });
        this.items = items || [];
        this.totalRows = res.headers['X-Total-Count'];
      });
    },
    mapPath(path) { return path.split('/').pop(); },
  },
  created() {
    this.debouncedGetItems = _.debounce(this.getItems,  500,
                                  {'leading': true, 'trailing': true});
    this.getItems();
  }
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