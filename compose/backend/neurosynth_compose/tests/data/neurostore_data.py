import requests
import pathlib
import json

API_URL = "https://neurostore.xyz/api"

DSET_ANNOT = {"6mmFfZG43btS": "tzMhQVRtPPT6"}

for dset, annot in DSET_ANNOT.items():
    dset_get = requests.get(f"https://neurostore.xyz/api/datasets/{dset}?nested=true")
    annot_get = requests.get(f"https://neurostore.xyz/api/annotations/{annot}")
    dset_json = dset_get.json()
    annot_json = annot_get.json()

    f_path = pathlib.Path(__file__).parent.resolve()
    dset_name = "_".join([w.lower() for w in dset_json["name"].split()]) + ".json"
    annot_name = dset_name.replace(".json", "_annotation.json")

    with open(f_path / dset_name, "w") as outfile:
        json.dump(dset_json, outfile)

    with open(f_path / annot_name, "w") as outfile:
        json.dump(annot_json, outfile)
