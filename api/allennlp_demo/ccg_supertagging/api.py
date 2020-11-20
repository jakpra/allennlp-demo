import os

from allennlp.predictors import Predictor
from allennlp_demo.common import config, http

from ccg.demo.reader import CCGReader
from ccg.demo.model import CCGModel
from ccg.demo.predictor import CCGSupertaggerPredictor

import ccg.util.argparse as ap


class MyModel(config.Model):
    def __init__(self):
        args = ap.main()
        self.model = CCGModel.load(args)
        self.reader = CCGReader(word_tag_delimiter='|')

    def load_predictor(self) -> Predictor:
        return predictor = CCGSupertaggerPredictor(self.model, self.reader)


class CCGSupertaggingModelEndpoint(http.ModelEndpoint):
    def __init__(self):
        c = MyModel()
	super().__init__(c)


if __name__ == "__main__":
    endpoint = CCGSupertaggingModelEndpoint()
    endpoint.run()
