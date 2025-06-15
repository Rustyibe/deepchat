<template>
    <div class="prompt-optimizer">
        <div v-if="!showOptimizedResult" class="optimize-button">
            <Button variant="outline" size="sm" :disabled="!originalPrompt.trim() || isOptimizing"
                @click="handleOptimize">
                <Icon icon="lucide:wand-2" class="mr-2 h-4 w-4" />
                {{ t('promptOptimizer.title') }}
            </Button>
        </div>

        <Dialog v-model:open="showModelSelect">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{{ t('promptOptimizer.title') }}</DialogTitle>
                    <DialogDescription>
                        {{ t('promptOptimizer.description') }}
                    </DialogDescription>
                </DialogHeader>
                <div class="grid gap-4 py-4">
                    <div class="space-y-2">
                        <Label>{{ t('promptOptimizer.originalPrompt') }}</Label>
                        <Textarea v-model="localOriginalPrompt" :placeholder="t('promptOptimizer.originalPrompt')"
                            class="h-32" />
                    </div>
                    <div class="space-y-2">
                        <Label>{{ t('promptOptimizer.selectModel') }}</Label>
                        <ModelSelect @update:model="handleModelSelect" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" @click="showModelSelect = false">
                        {{ t('promptOptimizer.cancel') }}
                    </Button>
                    <Button :disabled="!selectedModel || isOptimizing" @click="handleSend">
                        <Icon icon="lucide:send" class="mr-2 h-4 w-4" />
                        {{ t('promptOptimizer.send') }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="showOptimizedResult">
            <DialogContent class="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{{ t('promptOptimizer.title') }}</DialogTitle>
                    <DialogDescription>
                        {{ t('promptOptimizer.description') }}
                    </DialogDescription>
                </DialogHeader>
                <div class="grid gap-4 py-4">
                    <div class="space-y-2">
                        <Label>{{ t('promptOptimizer.originalPrompt') }}</Label>
                        <Textarea v-model="localOriginalPrompt" :placeholder="t('promptOptimizer.originalPrompt')"
                            class="h-32" readonly />
                    </div>
                    <div class="space-y-2">
                        <Label>{{ t('promptOptimizer.optimizedPrompt') }}</Label>
                        <Textarea v-model="optimizedPrompt" :placeholder="t('promptOptimizer.optimizedPrompt')"
                            class="h-32" readonly />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" :disabled="isOptimizing" @click="handleReoptimize">
                        <Icon icon="lucide:refresh-cw" class="mr-2 h-4 w-4" />
                        {{ t('promptOptimizer.reoptimize') }}
                    </Button>
                    <Button @click="handleApply">
                        {{ t('promptOptimizer.apply') }}
                    </Button>
                    <Button variant="outline" @click="handleCancel">
                        {{ t('promptOptimizer.cancel') }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ModelSelect from './ModelSelect.vue'
import type { RENDERER_MODEL_META } from '@shared/presenter'

const { t } = useI18n()

const props = defineProps<{
    originalPrompt: string
}>()

const emit = defineEmits<{
    (e: 'update:originalPrompt', value: string): void
    (e: 'apply', value: string): void
    (e: 'cancel'): void
}>()

const localOriginalPrompt = computed({
    get: () => props.originalPrompt,
    set: (value) => emit('update:originalPrompt', value)
})

const optimizedPrompt = ref('')
const isOptimizing = ref(false)
const showModelSelect = ref(false)
const selectedModel = ref<RENDERER_MODEL_META | null>(null)
const selectedProviderId = ref<string | null>(null)
const showOptimizedResult = ref(false)

interface OptimizePromptResponse {
    success: boolean
    optimizedPrompt?: string
    error?: string
}

const handleApply = () => {
    emit('apply', optimizedPrompt.value)
    showOptimizedResult.value = false
}

const handleCancel = () => {
    emit('cancel')
    showOptimizedResult.value = false
}

const handleOptimize = () => {
    showModelSelect.value = true
}

const handleModelSelect = async (model: RENDERER_MODEL_META, providerId: string) => {
    selectedModel.value = model
    selectedProviderId.value = providerId
}

const handleSend = async () => {
    if (!selectedModel.value || !selectedProviderId.value) return

    showModelSelect.value = false
    isOptimizing.value = true

    try {
        const response = await window.electron.ipcRenderer.invoke('optimize-prompt', {
            prompt: props.originalPrompt,
            model: selectedModel.value.id,
            providerId: selectedProviderId.value
        }) as OptimizePromptResponse

        if (response.success) {
            optimizedPrompt.value = response.optimizedPrompt || props.originalPrompt
            showOptimizedResult.value = true
        } else {
            throw new Error(response.error || t('promptOptimizer.optimizeFailed'))
        }
    } catch (error) {
        console.error('优化提示词失败:', error)
        // 可以添加错误提示
    } finally {
        isOptimizing.value = false
    }
}

const handleReoptimize = async () => {
    if (!selectedModel.value || !selectedProviderId.value) return

    isOptimizing.value = true
    try {
        const response = await window.electron.ipcRenderer.invoke('optimize-prompt', {
            prompt: props.originalPrompt,
            model: selectedModel.value.id,
            providerId: selectedProviderId.value
        }) as OptimizePromptResponse

        if (response.success) {
            optimizedPrompt.value = response.optimizedPrompt || props.originalPrompt
        } else {
            throw new Error(response.error || t('promptOptimizer.optimizeFailed'))
        }
    } catch (error) {
        console.error('重新优化提示词失败:', error)
        // 可以添加错误提示
    } finally {
        isOptimizing.value = false
    }
}
</script>