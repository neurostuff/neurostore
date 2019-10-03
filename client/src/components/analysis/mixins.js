import Analysis from './models';

const AnalysisManagerMixin = {
  data() {
    return {
      analysis: new Analysis(),
    };
  },
  computed: {
    storeAnalysis() { return this.$store.state.analysis.model; },
  },
  mounted() {
    const oldAnalysis = this.$store.state.analysis.model;
    let analysis;
    if (oldAnalysis == null) {
      analysis = new Analysis();
      this.saveAnalysis();
    } else {
      analysis = oldAnalysis.clone();
    }
    this.analysis = analysis;
  },
  methods: {
    saveAnalysis() {
      this.$store.commit('updateAnalysis', this.analysis);
    },
  },
  watch: {
    storeAnalysis() {
      this.analysis = this.storeAnalysis.clone();
    },
  },
};

export default AnalysisManagerMixin;
