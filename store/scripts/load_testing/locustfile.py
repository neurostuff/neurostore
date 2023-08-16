import json
import random
from locust import HttpUser, task, between, run_single_user


with open("concepts.json", "r") as c_j:
    concepts = json.load(c_j)

CONCEPT_NAMES = [c['name'] for c in concepts]


class QuickstartUser(HttpUser):
    HttpUser.host = "https://neurostore.xyz/api"
    wait_time = between(1, 5)

    @task
    def search_random_words(self):
        search_term = random.choice(CONCEPT_NAMES)
        self.client.get(f"/studies/?search='{search_term}'")
        self.client.get(f"/studies/?search='{search_term}'&page_size=29999")

    @task(3)
    def view_studyset_and_studies(self):
        result = self.client.get("/studysets/?page_size=100")
        if result.status_code != 200:
            return
        studyset_ids = [ss['id'] for ss in result.json()['results']]
        studyset_id = random.choice(studyset_ids)
        studyset = self.client.get(f"/studysets/{studyset_id}")
        if studyset.status_code != 200:
            return
        study_ids = [s for s in studyset.json()['studies']]
        for study_id in study_ids:
            self.client.get(f"/studies/{study_id}?nested=true")


# if launched directly, e.g. "python3 debugging.py", not "locust -f debugging.py"
if __name__ == "__main__":
    run_single_user(QuickstartUser)
