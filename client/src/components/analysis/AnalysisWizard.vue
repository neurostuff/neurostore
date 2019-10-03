<template>
  <b-container>
    <b-row>
      <b-col cols="11">
        <h1>Neurosynth analysis builder</h1>
      </b-col>
      <b-col cols="1">
        <b-button @click="saveModel">Save</b-button>
      </b-col>
    </b-row>
    <b-tabs card vertical active-nav-item-class="wizard-tabs"
            v-model="currentTab" @input="changeTab()">
      <b-tab title="Overview" active>
        <AnalysisOverview />
      </b-tab>
      <b-tab title="Data">
        <DataSelector />
      </b-tab>
      <b-tab title="Code">
        <DataAnnotator />
      </b-tab>
      <b-tab title="Model"><b-card-text>Tab Contents 3</b-card-text></b-tab>
      <b-tab title="Run"><b-card-text>Tab Contents 3</b-card-text></b-tab>
    </b-tabs>
  </b-container>
</template>

<script>
import AnalysisOverview from './AnalysisOverview';
import DataSelector from './DataSelector';
import DataAnnotator from './DataAnnotator';

export default {
    data: function() {
      return {
        currentTab: 0
      }
    },
    components: {
        AnalysisOverview,
        DataSelector,
        DataAnnotator,
    },
    computed: {
        model() { return this.$store.state.analysis.model; },
    },
    methods: {
        saveModel() {},
        changeTab() {
          window.location.hash = this.currentTab;
        },
    },
}
/*
WIZARD
- basic info
    - name
    - description
    - hypotheses/predictions
- type of meta-analysis
    - coordinate, image, or mixed?
    - single condition or meta-analytic contrast?
    - levels of analysis?
        - run, subject, study, etc.
    - what space?
    - whole-brain, voxels within ROI, or atlas-based?
- data selection
    - search by:
        - terms in study, analysis, contrast, etc.
        - type of image or coordinate
        - space (MNI, unknown, etc.)
- data assignment/annotation
    - assign to condition (if meta-analytic contrast)
    - matrix with arbitrary covariate columns
    - add indicators for built-in variables (studies, space, etc.)
- export/execute
    - export to:
        - GingerALE
        - MKDA
        - NiMARE
    - execute in:
        - NiMARE (if simple model)
        - NiMARE in browser (eventually, via Pyodide)
*/
</script>

<style>
a.nav-link {
  color: green;
  display: block;
  margin: 0px;
}

.nav-tabs .nav-link.active, .nav-tabs .nav-item.show .nav-link {
  border: 1px solid rgb(206, 232, 206);
  border-right: 5px solid darkgreen;
  margin-right: -3px;
  color: darkgreen;
}

li.nav-item {
  padding: 2px 0px;
  margin: 0px;
}

ul.nav-tabs {
  padding: 0px;
  background-color: white;
  border-right: 1px solid darkgreen;
  margin-right: 30px;
}
</style>