export interface ModelCard {
    id: string;
    archive_file?: string;
    citation?: string;
    contact?: string;
    contributed_by?: string;
    date?: string;
    description: string;
    developed_by?: string;
    display_name: string;
    evaluation_dataset?: string;
    model_type?: string;
    paper?: string;
    registered_model_name?: string;
    registered_predictor_name?: string;
    task_id?: string;
    training_dataset?: string;
    training_motivation?: string;
    training_preprocessing?: string;
    version?: string;
}

export interface ModelInfo {
    id: string;
    info: { model_card_data: ModelCard };
}

export const getModelCards = (data: ModelInfo[] | undefined, ids: string[]): ModelCard[] => {
    const ret = (data || [])
        .filter((m) => m.id && m.info && m.info.model_card_data && ids.includes(m.id))
        .map((m) => {
            m.info.model_card_data.id = m.id; // todo: remove this once we have real data
            return m.info.model_card_data;
        });
    return ret;
};
