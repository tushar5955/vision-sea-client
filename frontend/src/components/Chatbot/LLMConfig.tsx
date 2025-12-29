import React, { useState } from 'react';
import '../../styles/Chatbot/LLMConfig.css';

export interface LLMModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  description: string;
  maxTokens: number;
}

const availableModels: LLMModel[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and efficient model for most tasks',
    maxTokens: 128000
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Most capable OpenAI model',
    maxTokens: 128000
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fast and lightweight Claude model',
    maxTokens: 200000
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    description: 'Balanced Claude model for most tasks',
    maxTokens: 200000
  }
];

interface LLMConfigProps {
  isVisible: boolean;
  onClose: () => void;
  onModelSelect: (model: LLMModel) => void;
  currentModel?: LLMModel;
}

const LLMConfig: React.FC<LLMConfigProps> = ({
  isVisible,
  onClose,
  onModelSelect,
  currentModel
}) => {
  const [selectedModel, setSelectedModel] = useState<LLMModel>(
    currentModel || availableModels[0]
  );
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);

  const handleModelChange = (modelId: string) => {
    const model = availableModels.find(m => m.id === modelId);
    if (model) {
      setSelectedModel(model);
    }
  };

  const handleSave = () => {
    onModelSelect({
      ...selectedModel,
      // Add configuration parameters to the model
    });
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="llm-config-overlay">
      <div className="llm-config-modal">
        <div className="llm-config-header">
          <h3>LLM Configuration</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="llm-config-content">
          <div className="config-section">
            <label htmlFor="model-select">Model:</label>
            <select
              id="model-select"
              value={selectedModel.id}
              onChange={(e) => handleModelChange(e.target.value)}
              className="model-select"
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
            <p className="model-description">{selectedModel.description}</p>
          </div>

          <div className="config-section">
            <label htmlFor="temperature">Temperature: {temperature}</label>
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="slider"
            />
            <small>Controls randomness in responses (0 = deterministic, 2 = very creative)</small>
          </div>

          <div className="config-section">
            <label htmlFor="max-tokens">Max Tokens: {maxTokens}</label>
            <input
              id="max-tokens"
              type="range"
              min="100"
              max={selectedModel.maxTokens}
              step="100"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="slider"
            />
            <small>Maximum length of the response</small>
          </div>
        </div>

        <div className="llm-config-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="save-button" onClick={handleSave}>Save Configuration</button>
        </div>
      </div>
    </div>
  );
};

export default LLMConfig;