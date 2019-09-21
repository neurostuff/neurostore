<template>
  <b-container>
    <h3>Neurosynth Images</h3>
    <ImageTable />
  </b-container>
</template>

<script>
import Vue from 'vue';
import axios from 'axios';
import ImageTable from '../shared/ImageTable';

export default {
  components: {
    ImageTable
  },
}
</script>