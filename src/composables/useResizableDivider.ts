import { ref, type Ref } from 'vue'

interface UseResizableDividerOptions {
  minHeightPercent?: number
  maxHeightPercent?: number
  initialHeightPercent?: number
}

export function useResizableDivider(
  containerRef: Ref<HTMLElement | null>,
  options: UseResizableDividerOptions = {},
) {
  const { minHeightPercent = 10, maxHeightPercent = 75, initialHeightPercent = 50 } = options

  const subdivisionHeightPercent = ref<number>(initialHeightPercent)
  const isDragging = ref<boolean>(false)

  let containerTop = 0
  let containerHeight = 0

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging.value) return
    const mouseY = moveEvent.clientY - containerTop
    const percentFromTop = (mouseY / containerHeight) * 100
    const percentFromBottom = 100 - percentFromTop
    subdivisionHeightPercent.value = Math.max(
      minHeightPercent,
      Math.min(maxHeightPercent, percentFromBottom),
    )
  }

  const handleMouseUp = () => {
    if (isDragging.value) {
      isDragging.value = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }

  const onDividerMouseDown = (event: MouseEvent) => {
    if (!containerRef.value) return
    event.preventDefault()
    const containerRect = containerRef.value.getBoundingClientRect()
    containerTop = containerRect.top
    containerHeight = containerRect.height
    isDragging.value = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return {
    subdivisionHeightPercent,
    isDragging,
    onDividerMouseDown,
  }
}
