// 배포된 칭찬 릴레이 API를 그대로 써요. manifest의 host_permissions 덕분에 CORS 설정 없이 부를 수 있어요.
const API = 'https://praise-relay-jet.vercel.app/api/entries'
const NAME_MAX = 40
const MESSAGE_MAX = 500
const NAME_KEY = 'praise-relay-name'

const $ = (id) => document.getElementById(id)
const form = $('form')
const nameInput = $('name')
const toInput = $('to')
const messageInput = $('message')
const submit = $('submit')
const counter = $('counter')
const errorBox = $('error')
const statusBox = $('status')
const cards = $('cards')
const template = $('card-template')

let saving = false

// 서버와 같은 방식으로 세요. 앞뒤 공백은 빼고, 이모지도 한 글자로 쳐요.
function countChars(text) {
  return [...text.trim()].length
}

function showOver(element, count, max) {
  element.hidden = count <= max
  element.textContent = count > max ? `${max}자까지 쓸 수 있어요. 지금 ${count}자예요.` : ''
}

function refreshForm() {
  const nameCount = countChars(nameInput.value)
  const toCount = countChars(toInput.value)
  const messageCount = countChars(messageInput.value)
  showOver($('name-over'), nameCount, NAME_MAX)
  showOver($('to-over'), toCount, NAME_MAX)
  counter.textContent = `${messageCount} / ${MESSAGE_MAX}`
  counter.classList.toggle('over', messageCount > MESSAGE_MAX)
  const tooLong = nameCount > NAME_MAX || toCount > NAME_MAX || messageCount > MESSAGE_MAX
  submit.disabled = saving || tooLong || nameCount === 0 || messageCount === 0
}

function showError(message) {
  errorBox.hidden = !message
  errorBox.textContent = message || ''
}

async function readError(response) {
  try {
    const body = await response.json()
    if (body.error) return body.error
  } catch {
    // JSON이 아니면 아래 기본 문장을 써요.
  }
  return `서버가 요청을 처리하지 못했어요. (${response.status})`
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 글은 textContent로만 넣어서 HTML로 해석되지 않게 해요.
function renderCard(entry) {
  const card = template.content.firstElementChild.cloneNode(true)
  card.querySelector('.from').textContent = entry.name
  card.querySelector('.to').textContent = entry.to ? ` → ${entry.to}` : ''
  card.querySelector('.message').textContent = entry.message
  const time = card.querySelector('time')
  time.dateTime = entry.created_at
  time.textContent = formatTime(entry.created_at)
  return card
}

function renderList(entries) {
  cards.replaceChildren(...entries.map(renderCard))
  statusBox.hidden = entries.length > 0
  statusBox.textContent = '아직 칭찬이 없어요. 첫 칭찬을 남겨 보세요!'
}

async function loadEntries() {
  try {
    const response = await fetch(API)
    if (!response.ok) throw new Error(await readError(response))
    const { entries } = await response.json()
    renderList(entries)
  } catch (error) {
    statusBox.hidden = false
    statusBox.textContent = error.message || '칭찬 목록을 불러오지 못했어요.'
    statusBox.classList.add('error')
  }
}

form.addEventListener('input', refreshForm)

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (submit.disabled) return
  saving = true
  submit.textContent = '저장하는 중…'
  refreshForm()
  showError('')
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.value, message: messageInput.value, to: toInput.value }),
    })
    if (!response.ok) {
      showError(await readError(response))
      return
    }
    const { entry } = await response.json()
    localStorage.setItem(NAME_KEY, nameInput.value.trim())
    cards.prepend(renderCard(entry))
    statusBox.hidden = true
    toInput.value = ''
    messageInput.value = ''
  } catch {
    showError('서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.')
  } finally {
    saving = false
    submit.textContent = '칭찬 남기기'
    refreshForm()
  }
})

// 팝업은 열 때마다 새로 그려져서, 내 이름은 기억해 두었다가 채워 줘요.
nameInput.value = localStorage.getItem(NAME_KEY) || ''
refreshForm()
;(nameInput.value ? messageInput : nameInput).focus()
loadEntries()
