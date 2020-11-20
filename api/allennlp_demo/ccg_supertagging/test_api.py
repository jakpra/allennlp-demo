from allennlp_demo.common.testing import ModelEndpointTestCase
from allennlp_demo.ccg_supertagging.api import CCGSupertaggingModelEndpoint


class TestCCGSupertaggingModelEndpoint(ModelEndpointTestCase):
    endpoint = CCGSupertaggingModelEndpoint()
    predict_input = {
        "sentence": "Did Uriah honestly think he could beat The Legend of Zelda in under three hours?"
    }
