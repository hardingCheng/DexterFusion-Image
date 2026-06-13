import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Key, ExternalLink, ChevronDown, ChevronRight, Eye, EyeOff, Settings2, X } from 'lucide-react';
import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_GROUPS } from '../config/models';
import { ModelCredential } from '../types';

interface ApiKeyModalProps {
  onClose?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
  const {
    apiKey,
    modelCredentials,
    setApiKey,
    updateModelCredential,
    updateSettings,
    settings,
    fetchBalance,
  } = useAppStore();
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [showKeys, setShowKeys] = useState(false);
  const [model, setModel] = useState(settings.modelName || DEFAULT_IMAGE_MODEL);
  const [draftCredentials, setDraftCredentials] = useState<Record<string, ModelCredential>>(modelCredentials);
  const trimmedDefaultKey = inputKey.trim();
  const hasAnyModelKey = Object.values(draftCredentials).some((credential) => Boolean(credential.apiKey?.trim()));
  const canSubmit = Boolean(trimmedDefaultKey || hasAnyModelKey);

  // Sync local state with store settings (e.g. when updated via URL params)
  useEffect(() => {
    if (settings.modelName) setModel(settings.modelName);
    setDraftCredentials(modelCredentials);
    setInputKey(apiKey || '');
  }, [apiKey, modelCredentials, settings.modelName]);

  const updateDraftCredential = (
    modelName: string,
    field: keyof ModelCredential,
    value: string,
  ) => {
    setDraftCredentials((current) => ({
      ...current,
      [modelName]: {
        ...(current[modelName] || {}),
        [field]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    updateSettings({
      modelName: model
    });
    setApiKey(trimmedDefaultKey);
    Object.entries(draftCredentials).forEach(([modelName, credential]) => {
      updateModelCredential(modelName, credential);
    });
    // 立即尝试刷新余额
    setTimeout(() => fetchBalance(), 0);

    // 调用 onClose 如果提供
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl transition-colors duration-200 relative">
        {/* Close button (only show if onClose provided) */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            title="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="max-h-[90dvh] overflow-y-auto p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/50">
            <Key className="h-5 w-5 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">输入 API Key</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Key 仅存储在本地设备上，可为不同模型单独配置。
            </p>
          </div>
        </div>
        <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          <a 
            href="https://api.aigod.one/register?aff=z2C8" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center hover:text-amber-600 dark:hover:text-amber-400 transition"
          >
            使用兼容的 API 服务商创建密钥后填入即可。
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 sm:p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label htmlFor="apiKey" className="text-xs font-semibold text-gray-700 dark:text-gray-300">默认配置</label>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">大多数模型都会使用这里的 Key</span>
            </div>
            <label htmlFor="apiKey" className="sr-only">默认 API Key</label>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                id="apiKey"
                value={inputKey}
                onChange={(e) => setInputKey(e.currentTarget.value)}
                className="w-full rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
                placeholder="默认 API Key"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKeys((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition"
                title={showKeys ? '隐藏 API Key' : '查看 API Key'}
              >
                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
              如果某个模型需要不同 Key 或上游模型名，再在下面单独覆盖。
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="group flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500 transition-all"
            >
              <div className="flex items-center gap-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:underline">
                <Settings2 className="h-3 w-3" />
                <span>模型 Key 与重定向</span>
                {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </div>
            </button>

            <div 
              className={`grid transition-all duration-300 ease-in-out ${
                showAdvanced ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-3 sm:p-4 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-[130px_1fr] sm:items-center">
                    <label className="text-xs font-medium text-gray-500">默认模型</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.currentTarget.value)}
                      className="w-full rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                      placeholder={DEFAULT_IMAGE_MODEL}
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">可选覆盖</div>
                        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                          不填就使用默认配置；填写后只影响对应模型。
                        </p>
                      </div>
                      <div className="hidden sm:grid w-[58%] grid-cols-2 gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                        <span>专属 API Key</span>
                        <span>上游模型名</span>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-[36dvh] overflow-y-auto pr-1">
                      {IMAGE_MODEL_GROUPS.map((group) => (
                        <div key={group.label} className="space-y-1.5">
                          <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{group.label}</div>
                          {group.models.map((item) => {
                            const credential = draftCredentials[item.value] || {};
                            return (
                              <div
                                key={item.value}
                                className="grid gap-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 sm:grid-cols-[minmax(120px,0.75fr)_1fr_1fr] sm:items-center"
                              >
                                <div className="min-w-0 text-xs font-medium text-gray-700 dark:text-gray-300">
                                  <div className="truncate">{item.label}</div>
                                  <div className="truncate text-[10px] font-normal text-gray-400 dark:text-gray-500">{item.value}</div>
                                </div>
                                <div className="grid gap-2 sm:contents">
                                  <input
                                    type={showKeys ? 'text' : 'password'}
                                    value={credential.apiKey || ''}
                                    onChange={(e) => updateDraftCredential(item.value, 'apiKey', e.currentTarget.value)}
                                    className="w-full rounded-md bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                                    placeholder="留空使用默认 Key"
                                  />
                                  <input
                                    type="text"
                                    value={credential.upstreamModel || ''}
                                    onChange={(e) => updateDraftCredential(item.value, 'upstreamModel', e.currentTarget.value)}
                                    className="w-full rounded-md bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                                    placeholder="留空同前端模型"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始创作
          </button>
        </form>

        {/*
        <div className="mt-6 flex justify-center">
          <a
            href="https://cnb.cool/fuliai/comfyui/-/issues/11"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 transition"
          >
            <span>加入交流群</span>
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </div>
        */}
        </div>
      </div>
    </div>
  );
};
