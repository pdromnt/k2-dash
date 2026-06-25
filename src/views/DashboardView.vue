<script setup lang="ts">
import StatusPanel from '@/components/dashboard/StatusPanel.vue'
import ControlsPanel from '@/components/controls/ControlsPanel.vue'
import FilesPanel from '@/components/files/FilesPanel.vue'
import WebcamPanel from '@/components/webcam/WebcamPanel.vue'
import ConsolePanel from '@/components/console/ConsolePanel.vue'
import HistoryPanel from '@/components/dashboard/HistoryPanel.vue'
import FilamentPanel from '@/components/dashboard/FilamentPanel.vue'
import TimelapsePanel from '@/components/dashboard/TimelapsePanel.vue'
</script>

<template>
  <div class="max-w-[1800px] mx-auto px-8 lg:px-12 py-10 lg:py-14">
    <!-- Row 1: Status + Webcam -->
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 mb-8 lg:mb-12">
      <div class="xl:col-span-6"><StatusPanel /></div>
      <div class="xl:col-span-6"><WebcamPanel /></div>
    </div>

    <!-- Row 2: Filaments -->
    <div class="mb-8 lg:mb-12">
      <FilamentPanel />
    </div>

    <!-- Row 3: Controls + Files -->
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 mb-8 lg:mb-12">
      <div class="xl:col-span-7"><ControlsPanel /></div>
      <div class="xl:col-span-5"><FilesPanel /></div>
    </div>

    <!-- Row 4: Console + History -->
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 mb-8 lg:mb-12">
      <div class="xl:col-span-7"><ConsolePanel /></div>
      <div class="xl:col-span-5"><HistoryPanel /></div>
    </div>

    <!-- Row 5: Timelapse -->
    <div>
      <TimelapsePanel />
    </div>
  </div>
</template>
