# Study Editor

The study editor supports adding/cloning/editing existing studies on neurostore

## Components
The following components will be used to support the study editing interface.
What would you most likely want to edit?
- Study
  - metadata
  - Analysis (add/delete/edit)
    - Condition (add/delete/edit)
      - name
      - description
    - Image (add/delete/edit)
      - metadata
    - Point (add/delete/edit)
    - weight
    - description

### Datasets
A collection of studies that can be passed to
an arbitrary meta-workflow

### Annotations
A delimited text format where each row represents a study and
each column specifies a feature related to the study.
Annotations are attached to Datasets.
These features are either mutable or niche.
For example, the relative probability of word appearing in an abstract is
dependent on the other studies included in the dataset.
However, a feature like sample size is an immutable attribute of the
study, and commonly used in meta-workflows.


### Studies
A json/dictionary of attributes to uniquely identify a study and
provide commonly used information about the study to use in a
meta-workflow

### Analyses
A json/dictionary of an analysis within a study describing
a contrast between conditions and associated images/coordinates
connected to the analysis

### Conditions
A string describing a cognitive process and/or task condition, potentially
from an accepted ontology of cognitive terms.

### Images
A url linking to a statistical map on neurovault with additional information
about the type of image.

### Points
A collection of coordinates specified in a known coordinate system (MNI or TAL)

## Editing
If you would like to edit a study, there are two questions to ask:
1. Did I originally upload the study? (Do I own the study)
2. Would I like the original study to remain?
   (is there incorrect information in the study or is the change related to a matter of opinion?)

If you answered yes to either 1 or 2, then you will use the `/clone` endpoint,
if you own the study and do not want the original to remain, then use the `edit` endpoint.

### Creating a Dataset
