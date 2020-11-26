import React from 'react';
import { Tabs } from 'antd';
import { Tree } from 'hierplane';
import { Button } from 'antd';
import { withRouter } from 'react-router-dom';
import { Collapse } from 'antd';

import Model from '../Model';

import OutputField from '../OutputField';
import HighlightContainer from '../highlight/HighlightContainer';
import { Highlight } from '../highlight/Highlight';
import { truncateText } from '../DemoInput';
import AllHierplaneVisualization from '../CCGTagsHierplaneVisualization';
import { DemoVisualizationTabs } from './DemoStyles';

import SaliencyMaps from '../Saliency';
import InputReductionComponent, { InputReductionPanel } from '../InputReduction';
import {
    GRAD_INTERPRETER,
    IG_INTERPRETER,
    SG_INTERPRETER,
    INPUT_REDUCTION_ATTACKER,
} from '../InterpretConstants';

const title = 'CCG Supertagging';
// const apiUrl = () => `app/allennlp_demo/ccg_supertagging/predict`;

const NAME_OF_INPUT_TO_ATTACK = 'tokens';
const NAME_OF_GRAD_INPUT = 'grad_input_1';

const description = (
    <span>
        <span>
            Short definition of the task.
        </span>
    </span>
);

const defaultUsage = undefined;

const bashCommand = (modelUrl) => {
    return `echo '{"sentence": "Did Uriah honestly think he could beat The Legend of Zelda in under three hours ?"}' | \\
allennlp predict ${modelUrl} -`;
};

const pythonCommand = (modelUrl) => {
    return `from allennlp.predictors.predictor import Predictor
import allennlp_models.tagging
predictor = Predictor.from_path("${modelUrl}")
predictor.predict(
  sentence="Did Uriah honestly think he could beat The Legend of Zelda in under three hours ?"
)`;
};

// tasks that have only 1 model, and models that do not define usage will use this as a default
// undefined is also fine, but no usage will be displayed for this task/model
const buildUsage = (modelFile) => {
    const fullModelUrl = `https://storage.googleapis.com/allennlp-public-models/${modelFile}`;
    return {
        installCommand: 'pip install allennlp==1.0.0 allennlp-models==1.0.0',
        bashCommand: bashCommand(fullModelUrl),
        pythonCommand: pythonCommand(fullModelUrl),
        evaluationNote: (
            <span>
                The NER model was evaluated on the{' '}
                <a href="https://www.clips.uantwerpen.be/conll2003/ner/">CoNLL-2003</a> NER dataset.
                Unfortunately we cannot release this data due to licensing restrictions.
            </span>
        ),
        trainingNote: (
            <span>
                The NER model was trained on the{' '}
                <a href="https://www.clips.uantwerpen.be/conll2003/ner/">CoNLL-2003</a> NER dataset.
                Unfortunately we cannot release this data due to licensing restrictions.
            </span>
        ),
    };
};

const taskModels = [
    {
        name: 'AddrMLP',
        desc: (
            <span>
                This model is described in{' '}
                <a href="">
                    Prange, Schneider, and Srikumar 2020
                </a>
                . It uses a novel tree-structured constructive{' '}
                decoder that directly addresses each atomic category part,{' '}
                on top of <a href="">RoBERTa</a>.{' '}
                It was trained on <a href="">CCG Rebank</a>.
            </span>
        ),
        modelId: 'ccg_supertagging',
        usage: buildUsage('ner-model-2020.02.10.tar.gz'),
    },
];

const fields = [
    {
        name: 'sentence',
        label: 'Sentence',
        type: 'TEXT_INPUT',
        placeholder: `E.g. "John likes and Bill hates ice cream."`,
    },
    { name: 'model', label: 'Model', type: 'RADIO', options: taskModels, optional: true },
];

function getStrIndex(words, wordIdx) {
    if (wordIdx < 0) throw new Error(`Invalid word index: ${wordIdx}`);
    return words.slice(0, wordIdx).map((w) => {return `${w} `;}).join('').length;
}

function toTreeNode(tagObj, link, start, end, probs) {
            const children = probs[tagObj.addr - 1].slice(0, 4).map((probAlt) => {
                return {
                    word: `${probAlt[1].replace(/^\(|\)$/g, '')} \u2014 ${(probAlt[0] * 100).toFixed(2)}`,
                    link: 'alt',
                    nodeType: 'prob',
                };
            });
            let chainedProb = probs[tagObj.addr - 1][0][0];
            const parenSpans = [];
            let resultEnd = start;
            let argStart = end;
            if (tagObj.result) {
                resultEnd += tagObj.result.category.length;
                let resultNode;
                if (tagObj.result.arg) {
                    resultEnd += 2;
                    parenSpans.push(
                        {
                            spanType: 'ignored',
                            start,
                            end: start + 1,
                        },
                        {
                            spanType: 'ignored',
                            start: resultEnd - 1,
                            end: resultEnd,
                        },
                    );
                    resultNode = toTreeNode(tagObj.result, 'result', 
                        start + 1, resultEnd - 1, probs
                    );
                } else {
                    resultNode = toTreeNode(tagObj.result, 'result', 
                        start, resultEnd, probs
                    );
                }
                children.push(resultNode);
                chainedProb *= resultNode.chainedProb;
            }
            if (tagObj.arg) {
                argStart = resultEnd + tagObj.root.length;
                let argNode;
                if (tagObj.arg.arg) {
                    parenSpans.push(
                        {
                            spanType: 'ignored',
                            start: argStart,
                            end: argStart + 1,
                        },
                        {
                            spanType: 'ignored',
                            start: end - 1,
                            end: end,
                        },
                    );
                    argNode = toTreeNode(tagObj.arg, 'arg', 
                        argStart + 1, end - 1, probs
                    );
                } else {
                    argNode = toTreeNode(tagObj.arg, 'arg', 
                        argStart, end, probs
                    );
                }
                children.push(argNode);
                chainedProb *= argNode.chainedProb;
            }
            children.push(
                {
                    word: (chainedProb * 100).toFixed(2),
                    link: 'prob',
                    nodeType: 'prob',
                }
            );
            const node = {
                word: tagObj.root + (tagObj.attr.length > 0 ? `[${tagObj.attr}]` : ''),
                nodeType: tagObj.root,
                attributes: tagObj.attr,
                link,
                spans: [
                    {
                        start: resultEnd,
                        end: argStart,
                    },
                    ...parenSpans,
                ],
                chainedProb,
            };
            if (children.length > 0) {
                node['children'] = children;
            }
            return node;
        };

const atomLookup = {
        'S': {
            tooltip: 'Sentence',
            color: 'pink',
        },
        'N': {
            tooltip: 'Noun',
            color: 'green',
        },
        'NP': {
            tooltip: 'Noun Phrase',
            color: 'blue',
        },
        '.': {
            tooltip: 'Sentence-final Punctuation',
            color: 'gray',
        },
        'VP': {
            tooltip: 'Verb Phrase',
            color: 'orange',
        },
        'PP': {
            tooltip: 'Argument Prepositional Phrase',
            color: 'fuchsia',
        },
        ':': {
            tooltip: 'Colon / Other Sentence-internal Punctuation',
            color: 'gray',
        },
        ',': {
            tooltip: 'Comma',
            color: 'gray',
        },
        ';': {
            tooltip: 'Semicolon',
            color: 'gray',
        },
        'RQU': {
            tooltip: 'Right (Closing) Quotation Mark',
            color: 'gray',
        },
        'LQU': {
            tooltip: 'Left (Opening) Quotation Mark',
            color: 'gray',
        },
        'RRB': {
            tooltip: 'Right (Closing) Bracket',
            color: 'gray',
        },
        'LRB': {
            tooltip: 'Left (Opening) Bracket',
            color: 'gray',
        },
        'PR': {
            tooltip: 'Particle',
            color: 'cobalt',
        },
        'conj': {
            tooltip: 'Conjunction',
            color: 'teal',
        },
        '\\': {
            tooltip: 'Backward Slash',
            color: 'red',
        },
        '/': {
            tooltip: 'Forward Slash',
            color: 'purple',
        },
};

function toHierplaneTrees(allWords, allTags, allWordTags, allProbs) {
    const linkToPosition = {
        'prob': 'inside',
        'alt': 'left',
    };

//    const nodeTypeToStyle = {
//        'prob': ['color="gray"', 'font-size=10px'],
//    };
//    Object.keys(atomLookup).forEach((atom) => {
//        const info = atomLookup[atom];
//        nodeTypeToStyle[atom] = Object.keys(info).map((key) => {
//            return `${key}="${info[key]}"`;
//        });
//    });

    const text = allWordTags.join(' ');

    // We create a tree for each token
    const trees = allTags.map((tag, idx) => {
        const start = getStrIndex(allWordTags, idx);
        const wordEnd = start + allWords[idx].length;
        const catStart = wordEnd + 1;
        const catEnd = start + allWordTags[idx].length;

        return {
            text,
            linkToPosition,
//            nodeTypeToStyle,
            root: {
                word: allWords[idx],
                spans: [
                    {
                        start,
                        end: wordEnd,
                    },
                    {
                        spanType: 'ignored',
                        start: wordEnd,
                        end: catStart,
                    },
                    {
                        spanType: 'ignored',
                        start: catEnd,
                        end: catEnd + 1,
                    },
                ],
                children: [toTreeNode(tag, 'category', catStart, catEnd, allProbs[idx])],
            }
        };
    });

    return trees;
}

const VisualizationType = {
    TEXT: 'Text',
//    ALL_TREE: 'Tree',
    WORD_TREES: 'Trees',
};
Object.freeze(VisualizationType);

const TokenSpan = ({ token, index }) => {

    const focusToken = () => {
        if (index) {
            document.getElementById('demoTabs').setMergedActiveKey(VisualizationType.WORD_TREES);
            document.getElementById('wordTrees').setState({selectedIdx: index});
        }
    };

    const tag = token.tag;

    if (tag !== null) {
        // If token has entity value:
        // Display entity text wrapped in a <Highlight /> component.
        return (
            <Highlight
                label={tag.category}
                color={(atomLookup[tag.root] || {color: 'brown'}).color}
                tooltip={'Root: ' + (atomLookup[tag.root] || {tooltip: 'n/a'}).tooltip}
                type="link" onClick={focusToken}
            >
                {token.text}{' '}
            </Highlight>
        );
    } else {
        // If no entity:
        // Display raw text.
        return <span>{token.text} </span>;
    }
};

const getGradData = (instances, numGrads) => {
    const grads = [];
    for (let i = 1; i <= numGrads; i++) {
        grads.push(instances['instance_' + i.toString()].grad_input_1);
    }
    return grads;
};

const MySaliencyMaps = ({ interpretData, tokens, relevantTokenIdxs, interpretModel, requestData }) => {
    return null;
//    let simpleGradData;
//    let integratedGradData;
//    let smoothGradData;
//    if (interpretData) {
//        const numGrads = relevantTokenIdxs.length;
//        simpleGradData =
//            GRAD_INTERPRETER in interpretData
//                ? getGradData(interpretData[GRAD_INTERPRETER], numGrads)
//                : undefined;
//        integratedGradData =
//            IG_INTERPRETER in interpretData
//                ? getGradData(interpretData[IG_INTERPRETER], numGrads)
//                : undefined;
//        smoothGradData =
//            SG_INTERPRETER in interpretData
//                ? getGradData(interpretData[SG_INTERPRETER], numGrads)
//                : undefined;
//    }
//    const inputTokens = [];
//    const inputHeaders = [];
//    relevantTokenIdxs.forEach((index, i) => {
//        inputTokens.push(tokens.map((tok) => {return tok.text;}));
//        inputHeaders.push(
//            <div key={index} style={{ display: 'flex', flexWrap: 'wrap' }}>
//                <p>
//                    <strong>Interpretation for</strong>
//                </p>
//                <TokenSpan key={i} token={tokens[index]} />
//            </div>
//        );
//    });
//    const allInterpretData = { simple: simpleGradData, ig: integratedGradData, sg: smoothGradData };
//    return (
//        <SaliencyMaps
//            interpretData={allInterpretData}
//            inputTokens={inputTokens}
//            inputHeaders={inputHeaders}
//            interpretModel={interpretModel}
//            requestData={requestData}
//        />
//    );
};

const Attacks = ({ attackData, attackModel, responseData, tokens, relevantTokenIdxs }) => {
    let reducedInput;
    if (attackData && 'input_reduction' in attackData) {
        const reductionData = attackData.input_reduction;
        const formattedReduced = reductionData.final.map((reduced, index) => (
            <p key={index} style={{ display: 'flex', flexWrap: 'wrap' }}>
                <strong>Reduced input for</strong>
                <TokenSpan key={index} token={tokens[relevantTokenIdxs[index]]} />
                <strong>:</strong> <span>&nbsp;&nbsp;&nbsp;&nbsp;</span> {reduced.join(' ')}
                <br />
            </p>
        ));
        reducedInput = {
            original: reductionData.original.join(' '),
            formattedReduced: formattedReduced,
        };
    }
    return (
        <OutputField label="Model Attacks">
            <Collapse>
                <InputReductionPanel>
                    <InputReductionComponent
                        reducedInput={reducedInput}
                        reduceFunction={attackModel(
                            relevantTokenIdxs.map((idx) => {  // used to be requestData, but we want to control which instances to attack
                                const inst = responseData[idx];
                                return { words: inst.words, tags: inst.tags };
                            }),
                            INPUT_REDUCTION_ATTACKER,
                            NAME_OF_INPUT_TO_ATTACK,
                            NAME_OF_GRAD_INPUT
                        )}
                    />
                </InputReductionPanel>
            </Collapse>
        </OutputField>
    );
};


class WordHierplaneVisualization extends React.Component {
    constructor(...args) {
        super(...args);
        this.state = { selectedIdx: 0 };

        this.selectPrevWord = this.selectPrevWord.bind(this);
        this.selectNextWord = this.selectNextWord.bind(this);
    }

    selectPrevWord() {
        const nextIdx =
            this.state.selectedIdx === 0 ? this.props.trees.length - 1 : this.state.selectedIdx - 1;
        this.setState({ selectedIdx: nextIdx });
    }

    selectNextWord() {
        const nextIdx =
            this.state.selectedIdx === this.props.trees.length - 1 ? 0 : this.state.selectedIdx + 1;
        this.setState({ selectedIdx: nextIdx });
    }

    render() {
        if (this.props.trees) {
            const words = this.props.trees.map(({ root: { word } }) => word);

            const totalWordCount = words.length;
            const selectedWordIdxLabel = this.state.selectedIdx + 1;
            const selectedWord = words[this.state.selectedIdx];

            return (
                <div className="hierplane__visualization">
                    <div className="hierplane__visualization">
                        <Button
                            className="hierplane__visualization-ccg__prev"
                            type="link"
                            ghost
                            onClick={this.selectPrevWord}>
                            <svg width="12" height="12">
                                <use xlinkHref="#icon__disclosure"></use>
                            </svg>
                        </Button>
                        <Button type="link" ghost onClick={this.selectNextWord}>
                            <svg width="12" height="12">
                                <use xlinkHref="#icon__disclosure"></use>
                            </svg>
                        </Button>
                        <span className="hierplane__visualization">
                            Word {selectedWordIdxLabel} of {totalWordCount}:{' '}
                            <strong>{selectedWord}</strong>
                        </span>
                    </div>
                    <Tree tree={this.props.trees[this.state.selectedIdx]} theme="light" />
                    <MySaliencyMaps
                        interpretData={this.props.interpretData}
                        tokens={this.props.tokens}
                        relevantTokenIdxs={[this.state.selectedIdx]}
                        interpretModel={this.props.interpretModel}
                        requestData={this.props.requestData}
                    />
                    <Attacks
                        attackData={this.props.attackData}
                        attackModel={this.props.attackModel}
                        responseData={this.props.responseData}
                        tokens={this.props.tokens}
                        relevantTokenIdxs={[this.state.selectedIdx]}
                    />
                </div>
            );
        } else {
            return null;
        }
    }
}


const Output = ({
    responseData,
    requestData,
    interpretData,
    interpretModel,
    attackData,
    attackModel,
}) => {
    console.log('responseData', responseData);
    console.log('requestData', requestData);
    console.log('interpretData', interpretData);
    console.log('attackData', attackData);

    
    const allWords = [],
          allTags = [],
          allWordTags = [],
          allProbs = [];
    Object.values(responseData).forEach((sentence, idx) => {
        allWords.push(sentence.words[idx].text);
        allTags.push(...(sentence.tags));
        allWordTags.push(...(sentence.tags.map((tag, i) => {
            return `${sentence.words[idx].text}|${tag.category}`;
        })));
        allProbs.push(...(sentence.probs));
    });

    // Defining an empty array for building a list of formatted token objects.
    const formattedTokens = [];
    let numTokens = 0;
    // Iterate through array of tags from response data.
    allWords.forEach(function (word, i) {
        // Defining an empty object to store temporary token data.
        let tokenObj = {};
        tokenObj = {
            text: word,
            tag: allTags[i],
        };
        formattedTokens.push(tokenObj);
        numTokens++;
    });

    const trees = toHierplaneTrees(allWords, allTags, allWordTags, allProbs);

    return (
        <div className="model__content">
            <DemoVisualizationTabs id="demoTabs">
                {Object.keys(VisualizationType).map((tpe) => {
                    const vizType = VisualizationType[tpe];
                    let viz = null;

                    if (Array.isArray(formattedTokens) && formattedTokens.length > 0) {
                        switch (vizType) {
                            case VisualizationType.TEXT:
                            default:
                                viz = (
                                    <OutputField>
                                        <HighlightContainer layout="bottom-labels">
                                            {formattedTokens.map((tok, i) => {
                                                return (
                                                    <TokenSpan key={i} token={tok} index={i} />
                                                );
                                            })}
                                        </HighlightContainer>
                                        <br />
                                        <br />
                                        <MySaliencyMaps
                                            interpretData={interpretData}
                                            tokens={formattedTokens}
                                            relevantTokenIdxs={[...Array(numTokens).keys()]}
                                            interpretModel={interpretModel}
                                            requestData={requestData}
                                        />
                                        <Attacks
                                            attackData={attackData}
                                            attackModel={attackModel}
                                            responseData={responseData}
                                            tokens={formattedTokens}
                                            relevantTokenIdxs={[...Array(numTokens).keys()]}
                                        />
                                    </OutputField>
                                );
                                break;
                            case VisualizationType.WORD_TREES:
                                viz = (
                                    <WordHierplaneVisualization id="wordTrees"
                                        trees={trees}
                                        tokens={formattedTokens}
                                        responseData={responseData}
                                        interpretData={interpretData}
                                        interpretModel={interpretModel}
                                        attackData={attackData}
                                        attackModel={attackModel}
                                    />
                                );
                                break;
                            case VisualizationType.ALL_TREE:
                                const mergedTree = {
                                    text: trees[0].text,
                                    linkToPosition: trees[0].linkToPosition,
//                                    nodeTypeToStyle: trees[0].nodeTypeToStyle,
                                    root: {
                                        word: formattedTokens.map((tok) => {
                                            return tok.text;
                                        }).join(' '),
                                        children: trees.map((t) => {
                                            return t.root;
                                        }),
                                    },
                                };
                                viz = (
                                    <OutputField>
                                        <AllHierplaneVisualization
                                            tree={mergedTree}
                                        />
                                        <br />
                                        <br />
                                        <MySaliencyMaps
                                            interpretData={interpretData}
                                            tokens={formattedTokens}
                                            relevantTokenIdxs={[...Array(numTokens).keys()]}
                                            interpretModel={interpretModel}
                                            requestData={requestData}
                                        />
                                        <Attacks
                                            attackData={attackData}
                                            attackModel={attackModel}
                                            responseData={responseData}
                                            tokens={formattedTokens}
                                            relevantTokenIdxs={[...Array(numTokens).keys()]}
                                        />
                                    </OutputField>
                                );
                                break;
                        }
                    }

                    if (viz == null) {
                        return (
                            <NoOutputMessage>
                                No output. Please revise the sentence and try again.
                            </NoOutputMessage>
                        );
                    }
                    return (
                        <Tabs.TabPane key={vizType} tab={vizType}>
                            {viz}
                        </Tabs.TabPane>
                    );
                })}
            </DemoVisualizationTabs>
        </div>
    );
};

const examples = [
    'The statistics quoted by the " new " Census Bureau report ( garnered from 1984 to 1986 ) are out of date , certainly as an average for the Northeast , and possibly for the rest of the country .',
    "This shirt was bought at Grandpa Joe's in downtown Deep Learning.",
    'AllenNLP is a PyTorch-based natural language processing library developed at the Allen Institute for Artificial Intelligence in Seattle.',
    'Did Uriah honestly think he could beat The Legend of Zelda in under three hours?',
    'Michael Jordan is a professor at Berkeley.',
    "My preferred candidate is Cary Moon, but she won't be the next mayor of Seattle.",
    'If you like Paul McCartney you should listen to the first Wings album.',
    "When I told John that I wanted to move to Alaska, he warned me that I'd have trouble finding a Starbucks there.",
].map((sentence) => ({ sentence, snippet: truncateText(sentence) }));

const getUrl = (model, ...paths) => {
    const selectedModel =
        taskModels.find((t) => t.name === model) ||
        taskModels.find((t) => t.modelId === model) ||
        taskModels[0];
    return `/${['api', selectedModel.modelId, ...paths].join('/')}`;
};

const apiUrl = ({ model }) => {
    return getUrl(model, 'predict');
};

const apiUrlInterpret = ({ model }, interpreter) => {
    return getUrl(model, 'interpret', interpreter);
};

const apiUrlAttack = ({ model }, attacker) => {
    return getUrl(model, 'attack', attacker);
};

export default withRouter((props) => <Model {...props} {...modelProps} />);
const modelProps = {
    apiUrl,
    apiUrlInterpret,
    apiUrlAttack,
    title,
    description,
    fields,
    examples,
    Output,
    defaultUsage,
};
