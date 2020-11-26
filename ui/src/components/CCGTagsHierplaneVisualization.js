import React from 'react';
import { Tree } from 'hierplane';
import { Button } from 'antd';
import { Collapse } from 'antd';

import OutputField from './OutputField';
import { Highlight } from './highlight/Highlight';
import SaliencyMaps from './Saliency';
import InputReductionComponent, { InputReductionPanel } from './InputReduction';
import {
    GRAD_INTERPRETER,
    IG_INTERPRETER,
    SG_INTERPRETER,
    INPUT_REDUCTION_ATTACKER,
} from './InterpretConstants';

const NAME_OF_INPUT_TO_ATTACK = 'tokens';
const NAME_OF_GRAD_INPUT = 'grad_input_1';

class AllHierplaneVisualization extends React.Component {
    render() {
        if (this.props.tree) {
            return (
                <div className="hierplane__visualization">
                    <Tree tree={this.props.tree} theme="light" />
                </div>
            );
        } else {
            return null;
        }
    }
}


const TokenSpan = ({ token }) => {
    // Lookup table for atomic category values:

    const tag = token.tag;

    if (tag !== null) {
        // If token has entity value:
        // Display entity text wrapped in a <Highlight /> component.
        return (
            <Highlight
                label={tag.category}
                color={(atomLookup[tag.root] || {color: 'brown'}).color}
                tooltip={'Root: ' + (atomLookup[tag.root] || {tooltip: 'n/a'}).tooltip}>
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

const MySaliencyMaps = ({ interpretData, tokens, relevantTokens, interpretModel, requestData }) => {
    let simpleGradData;
    let integratedGradData;
    let smoothGradData;
    if (interpretData) {
        const numGrads = relevantTokens.length;
        simpleGradData =
            GRAD_INTERPRETER in interpretData
                ? getGradData(interpretData[GRAD_INTERPRETER], numGrads)
                : undefined;
        integratedGradData =
            IG_INTERPRETER in interpretData
                ? getGradData(interpretData[IG_INTERPRETER], numGrads)
                : undefined;
        smoothGradData =
            SG_INTERPRETER in interpretData
                ? getGradData(interpretData[SG_INTERPRETER], numGrads)
                : undefined;
    }
    const inputTokens = [];
    const inputHeaders = [];
    relevantTokens.forEach((token, index) => {
        inputTokens.push(tokens.map((tok) => {return tok.text;}));
        inputHeaders.push(
            <div key={index} style={{ display: 'flex', flexWrap: 'wrap' }}>
                <p>
                    <strong>Interpretation for</strong>
                </p>
                <TokenSpan key={index} token={token} />
            </div>
        );
    });
    const allInterpretData = { simple: simpleGradData, ig: integratedGradData, sg: smoothGradData };
    return (
        <SaliencyMaps
            interpretData={allInterpretData}
            inputTokens={inputTokens}
            inputHeaders={inputHeaders}
            interpretModel={interpretModel}
            requestData={requestData}
        />
    );
};

const Attacks = ({ attackData, attackModel, requestData, tokens, relevantTokenss }) => {
    let reducedInput;
    if (attackData && 'input_reduction' in attackData) {
        const reductionData = attackData.input_reduction;
        const formattedReduced = reductionData.final.map((reduced, index) => (
            <p key={index} style={{ display: 'flex', flexWrap: 'wrap' }}>
                <strong>Reduced input for</strong>
                <TokenSpan key={index} token={tokens[index]} />
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
                            requestData,
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
                    relevantTokens={this.props.tokens.slice(this.state.selectedIdx, this.state.selectedIdx+1)}
                    interpretModel={this.props.interpretModel}
                    requestData={this.props.requestData}
                    />
                    <Attacks
                    attackData={this.props.attackData}
                    attackModel={this.props.attackModel}
                    requestData={this.props.requestData}
                    tokens={this.props.tokens}
                    relevantTokens={this.props.tokens.slice(this.state.selectedIdx, this.state.selectedIdx+1)}
                    />
                </div>
            );
        } else {
            return null;
        }
    }
}

export default AllHierplaneVisualization;
// export { WordHierplaneVisualization };
