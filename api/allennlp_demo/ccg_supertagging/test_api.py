from allennlp_demo.common.testing import ModelEndpointTestCase
from allennlp_demo.ccg_supertagging.api import CCGSupertaggingModelEndpoint


class TestCCGSupertaggingModelEndpoint(ModelEndpointTestCase):
    endpoint = CCGSupertaggingModelEndpoint()
    predict_input = {
        "sentence": "Did Uriah honestly think he could beat The Legend of Zelda in under three hours?"
    }
    attack_input = None
    predict_okay = None

    def test_predict(self):
        """
        Test the /predict route.
        """
        if self.predict_okay:
            return
        response = self.client.post("/predict", json=self.predict_input)
        # print('response', response)
        # print(response.is_json)
        # print(response.headers)
        # print(response.data)
        # print(response.__dict__)
        self.check_response_okay(response, cache_hit=False)

        responseData = response.get_json()
        # self.attack_input = { k: {'tags': inst['tags'], 'words': inst['words']}
        #                     for k, inst in responseData.items() }
        self.attack_input = { '0': {'tags': responseData['0']['tags'], 'words': responseData['0']['words']} }
        self.predict_okay = True

    def test_attack(self):
        if self.attack_input is None:
            # assert False, 'Need to run predict before running attacks.'
            self.test_predict()

        inputs = dict(
            inputs=self.attack_input,
            input_field_to_attack="tokens",
            grad_input_field="grad_input_1",
            ignore_tokens=None,
            target=None)
        response = self.client.post("/attack/input_reduction", json=inputs)
        # print(response)
        # print(response.is_json)
        # print(response.headers)
        # print(response.data)
        # print(response.__dict__)
        self.check_response_okay(response, cache_hit=False)

