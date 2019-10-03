import cloneDeep from 'lodash';

export default class Analysis {
  constructor() {
    this.name = '';
    this.description = '';
    this.type = 'images';
    this.conditions = 1;
    this.selectedItems = [];
    this.selectedIds = [];
    this.variables = [];
    this.weights = [];
  }

  createWeights() {
    const nItems = this.selectedItems.length;

    // Array of fields
    const variables = [{ key: 'observation', editable: false }];
    variables.push(...new Array(this.conditions).fill(null).map((x, i) =>
      ({ key: `condition${i + 1}` })));

    // Array of rows, to populate table
    const weights = new Array(nItems).fill(null).map(
      (x, i) => {
        const w = { observation: this.selectedItems[i].filename,
          id: this.selectedItems[i].id };
        Object.assign(w, ...variables.slice(1).map(v => ({ [v.key]: 0 })));
        return w;
      });

    this.variables = variables;
    this.weights = weights;
  }

  selectItem(item) {
    const index = this.selectedItems.findIndex(i => i.id === item.id);
    if (index === -1) {
      this.selectedItems.push(item);
    }
  }

  deselectItem(id) {
    const index = this.selectedItems.findIndex(item => item.id === id);
    if (index !== -1) {
      this.selectedItems.splice(index, 1);
    }
  }

  updateSelectedIds(value) {
    this.selectedIds = value;
  }

  clone() {
    const analysis = new Analysis();
    analysis.name = this.name;
    analysis.description = this.description;
    analysis.type = this.type;
    analysis.conditions = this.conditions;
    analysis.selectedItems = cloneDeep(this.selectedItems).value();
    analysis.selectedIds = [...this.selectedIds];
    analysis.variables = cloneDeep(this.variables).value();
    analysis.weights = cloneDeep(this.weights).value();
    return analysis;
  }
}
