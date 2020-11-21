import CCGSupertagging from './components/demos/CCGSupertagging';
import annotateIcon from './icons/annotate-14px.svg';
import otherIcon from './icons/other-14px.svg';
import parseIcon from './icons/parse-14px.svg';
import passageIcon from './icons/passage-14px.svg';
import questionIcon from './icons/question-14px.svg';
import addIcon from './icons/add-14px.svg';

// This is the order in which they will appear in the menu
const modelGroups = [
    {
        label: 'Annotate a sentence',
        iconSrc: annotateIcon,
        defaultOpen: true,
        models: [
            {
                model: 'ccg-supertagging',
                name: 'CCG Supertagging',
                component: CCGSupertagging,
            },
        ],
    },
];

// Create mapping from model to component
const modelComponents = {};
modelGroups.forEach((mg) =>
    mg.models.forEach(({ model, component }) => (modelComponents[model] = component))
);

const modelRedirects = {};
modelGroups.forEach((mg) =>
    mg.models.forEach(({ model, redirects }) => {
        if (redirects) {
            redirects.forEach((redirect) => (modelRedirects[redirect] = model));
        }
    })
);

export { modelComponents, modelGroups, modelRedirects };
