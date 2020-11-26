import os
import pathlib

from copy import deepcopy

from allennlp.common.util import JsonDict, sanitize
from allennlp.data.fields import TextField, SequenceLabelField
from allennlp.predictors import Predictor
from allennlp_demo.common import config, http

from ccg.allennlp.reader import CCGReader
from ccg.allennlp.model import CCGModel
from ccg.allennlp.predictor import CCGSupertaggerPredictor

import argparse as ap



class MyModel(config.Model):
    def __init__(self):
        super(MyModel, self).__init__('ccg_supertagging', None)
        args = ap.Namespace(model=f"{os.environ['CCG_MODELS']}/addrmlp-att-rebank-r1",
                            tasks=[f"{os.environ['CCG_TASKS']}/atomic_featurized_enc_attention_rebank"],
                            span_encoder='roberta',
                            pretrained_bert='roberta-base',
                            finetune=True,  # needed to examine gradients in embedding layer
                            testing_files=[],
                            hidden_dims=[],
                            dropout=[],
                            tree_hidden_dim=0,
                            transformer_layers=0,
                            attention_heads=0,
                            device='cpu',
                            cuda=False,
                            cuda_devices=[])
        self.model = CCGModel.load(args)
        self.reader = CCGReader(word_tag_delimiter='|')

    def load_predictor(self) -> Predictor:
        return CCGSupertaggerPredictor(self.model, self.reader)


class CCGSupertaggingModelEndpoint(http.ModelEndpoint):
    def __init__(self):
        c = MyModel()
        super().__init__(c)

    def attack(self, attacker_id: str, attack: JsonDict) -> JsonDict:
        """
        Modifies the input (e.g. by adding or removing tokens) to try to change the model's predicti$
        in some desired manner.
        """
        if attacker_id not in config.VALID_ATTACKERS:
            raise http.UnknownAttackerError(attacker_id)
        attacker = self.attackers.get(attacker_id)
        if attacker is None:
            raise http.InvalidAttackerError(attacker_id)

        print('attack', attack)

        inputs = attack['inputs']
        input_field_to_attack = attack.get('input_field_to_attack', 'tokens')
        grad_input_field = attack.get('grad_input_field', 'grad_input_1')
        ignore_tokens = attack.get('ignore_tokens', None)
        target = attack.get('target', None)

        if target is not None:
            raise ValueError("Input reduction does not implement targeted attacks")
        ignore_tokens = ["@@NULL@@"] if ignore_tokens is None else ignore_tokens

        original_instances = self.predictor.labeled_json_to_labeled_instances(inputs)

        original_text_field: TextField = original_instances[0][  # type: ignore
            input_field_to_attack
        ]
        original_tokens = deepcopy(original_text_field.tokens)
        final_tokens = []
        for instance in original_instances:
            final_tokens.append(
                attacker._attack_instance(
                    inputs, instance, input_field_to_attack, grad_input_field, ignore_tokens
                )
            )
        return sanitize({"final": final_tokens, "original": original_tokens})



if __name__ == "__main__":
    endpoint = CCGSupertaggingModelEndpoint()
    endpoint.run()
