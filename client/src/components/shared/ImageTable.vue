<template>
  <div>
    <b-row v-if="filters">
      <b-col md="6" class="my-1">
        <b-form-group label-cols-sm="3" label="All fields:" class="mb-0">
            <b-form-input v-model="search.search" placeholder="Type to search"
                          @input="debouncedGetItems">
            </b-form-input>
        </b-form-group>
        <b-form-group label-cols-sm="3" label="Filename/URL:" class="mb-0">
            <b-form-input v-model="search.filename" placeholder="Type to search"
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
      <b-col cols="12">
      <b-table striped small responsive
        :items="tableRows"
        :fields="fields"
        :per-page="0"
        :current-page="currentPage"
        :sort-by="sortBy"
        :sort-desc="sortDesc"
        @sort-changed="changeSort"
        no-local-sorting>
        <template v-slot:head(selected)="data">
          <b-form-checkbox @change="toggleAll" />
        </template>
        <template v-slot:cell(selected)="data">
          <b-form-checkbox :value=data.item.id v-model="selectedIds" />
        </template>
        <template slot="filename" slot-scope="data">
          <a :href="`/images/${data.item.id}`">{{data.item.filename}}</a>
        </template>
        <template slot="analysis_name" slot-scope="data">
          <a :href="`/analyses/${data.item.analysis}`">{{data.item.analysis_name}}</a>
        </template>
        <template slot="add_date" slot-scope="data">
          {{data.item.add_date | formatDate}}
        </template>
      </b-table>
      </b-col>
    </b-row>

    <b-row>
      <b-col md="6" class="my-1">
        <b-pagination
          v-model="currentPage"
          :total-rows="totalRows"
          :per-page="perPage"
          class="my-0"
          @change="changePage"
        ></b-pagination>
      </b-col>
    </b-row>

  </div>
</template>

<script>
import Vue from 'vue';
import axios from 'axios';
import _ from 'lodash';
import moment from 'moment';

export default {
  props: {
    source: {
      type: String,
      default: 'server'
    },
    filters: {
      type: Boolean,
      default: true
    }
  },
  filters: {
    formatDate: function(date) {
      return moment(date).format('MM/DD/YYYY');
    }
  },
  data() {
    return {
      items: [],
      search: {
          search: null,
          filename: null,
          value_type: null,
          space: null,
      },
      fields: [
        {
          key: 'selected',
          label: 'Selected',
          sortable: false,
        },
        {
          key: 'filename',
          label: 'Filename',
          sortable: true,
          class: 'max-width-200',
        }, {
          key: 'analysis_name',
          label: 'Analysis',
          sortable: true,
          class: 'max-width-200',
        }, {
          key: 'value_type',
          label: 'Type',
          sortable: true,
        }, {
          key: 'space',
          label: 'Space',
          sortable: true,
        }, {
          key: 'add_date',
          label: 'Date',
          sortable: true,
        },
      ],
      filter: null,
      perPage: 20,
      pageOptions: [10, 20, 50, 100],
      sortBy: 'add_date',
      sortDesc: true,
      currentPage: 1,
      totalRows: null,
    }
  },
  computed: {
    selectedItems() {
        return this.$store.state.analysis.selectedItems;
    },
    selectedIds: {
      get() {
        return this.$store.state.analysis.selectedIds;
      },
      set(value) {
        this.$store.commit('updateSelectedIds', value);
      }
    },
    tableRows() {
      if (this.source == "server")
        return this.items;
      return this.selectedItems;
    }
  },
  methods: {
    changePage(page) {
      this.currentPage = page;
      this.getItems();
    },
    changeSort(e) {
      this.sortBy = e.sortBy;
      this.sortDesc = e.sortDesc;
      this.getItems();
    },
    toggleAll(checked) {
      // Toggle selection status for all rows in table
      const activeIds = this.items.map(item => item.id);
      if (checked) {
        this.selectedIds = [...new Set(activeIds.concat(this.selectedIds))];
      } else {
        let dropIds = new Set(activeIds);
        this.selectedIds = this.selectedIds.filter(x => !dropIds.has(x));
      }
    },
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
        this.totalRows = res.headers['x-total-count'];
      });
    },
    deselectItem(id) {
      this.$store.commit({type: 'deselectItem', id: id});
    },
  },
  created() {
    this.debouncedGetItems = _.debounce(this.getItems,  500,
                                  {'leading': true, 'trailing': true});
    this.getItems();
  },
  watch: {
    selectedIds: function(newItems, oldItems) {
      var dropped = oldItems.filter((item) => !newItems.includes(item));
      dropped.forEach((id) => {
          this.$store.commit('deselectItem', id);
      });

      var added = newItems.filter((item) => !oldItems.includes(item));
      added.forEach((id) => {
        var item = Object.assign({}, this.items.find((item) => item.id == id));
        this.$store.commit('selectItem', item);
      });
      console.log(this.selectedIds);
    }
  }
}
</script>
<style>
.max-width-200 {
  max-width: 400px;
  word-wrap: break-word;
}
.image-table {
    margin-top: 15px;
}
</style>