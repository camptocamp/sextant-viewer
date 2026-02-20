const viewer = document.getElementById('viewer')

const el = document.createElement('div')
document.body.appendChild(el)

viewer.addEventListener('map-extent-change', (event) => {
  el.textContent = event.detail.toString()
})
