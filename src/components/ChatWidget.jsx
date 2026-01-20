import React, { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { listenSubUsers } from '../services/users'
import { listenChatMessages, sendMessage, listenUserChats, markChatAsRead, getChatId } from '../services/chat'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import notificationSound from '../assets/sons/notification.mp3'

export default function ChatWidget({ user }) {
  const [isOpen, setIsOpen] = useState(false)
  const [colleagues, setColleagues] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [userChats, setUserChats] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const messagesEndRef = useRef(null)

  // Identify the Owner ID
  const ownerId = user?.ownerId || user?.id
  // Identify the Current User Unique ID (Owner ID if owner, Member ID if member)
  const myUid = user?.memberId || user?.id

  // Load sound preference
  useEffect(() => {
    if (myUid) {
        const saved = localStorage.getItem(`chat_sound_enabled_${myUid}`)
        if (saved !== null) {
            setSoundEnabled(saved === 'true')
        }
    }
  }, [myUid])

  // Save sound preference
  const toggleSound = () => {
      const newState = !soundEnabled
      setSoundEnabled(newState)
      if (myUid) {
          localStorage.setItem(`chat_sound_enabled_${myUid}`, String(newState))
      }
  }

  // Load colleagues (Owner + Members)
  useEffect(() => {
    if (!ownerId) return

    let unsubMembers = () => {}

    const load = async () => {
      // 1. Fetch Owner details (if current user is not owner, add owner to list)
      let ownerObj = null
      // If I am not the owner (myUid is distinct from ownerId, OR I am a member)
      if (myUid !== ownerId) {
        try {
          const snap = await getDoc(doc(db, 'users', ownerId))
          if (snap.exists()) {
            ownerObj = { id: snap.id, ...snap.data(), role: 'Dono' }
          }
        } catch (e) {
          console.error('Error fetching owner', e)
        }
      }

      // 2. Listen to members
      unsubMembers = listenSubUsers(ownerId, (list) => {
        // Filter out self by ID and Email (safety check)
        // Ensure IDs are strings for comparison
        const myUidStr = String(myUid)
        const myEmail = user.email ? user.email.toLowerCase() : ''
        
        const members = list.filter(m => {
            const mId = String(m.id)
            const mEmail = m.email ? m.email.toLowerCase() : ''
            return mId !== myUidStr && mEmail !== myEmail
        })
        
        // Combine
        let final = []
        // Only add owner if I am NOT the owner (check by ID and Email)
        if (ownerObj) {
            const oId = String(ownerObj.id)
            const oEmail = ownerObj.email ? ownerObj.email.toLowerCase() : ''
            
            if (oId !== myUidStr && oEmail !== myEmail) {
                final.push(ownerObj)
            }
        }
        final = [...final, ...members]
        
        setColleagues(final)
      })
    }

    load()
    return () => unsubMembers()
  }, [user, ownerId, myUid])

  // Listen to my chats metadata (unread counts)
  useEffect(() => {
    if (!myUid) return
    const unsub = listenUserChats(myUid, (chats) => {
      setUserChats(chats)
    })
    return () => unsub()
  }, [myUid])

  // Mark as read when viewing a user or when new messages arrive for the viewed user
  useEffect(() => {
    if (selectedUser && isOpen) {
        const chatId = getChatId(myUid, selectedUser.id)
        const chat = userChats.find(c => c.id === chatId)
        const unread = chat?.unreadCounts?.[myUid] || 0
        if (unread > 0) {
            markChatAsRead(myUid, selectedUser.id)
        }
    }
  }, [selectedUser, userChats, myUid, isOpen])

  // Listen to messages when a user is selected
  useEffect(() => {
    if (!selectedUser) {
      setMessages([])
      return
    }

    const unsub = listenChatMessages(myUid, selectedUser.id, (msgs) => {
      setMessages(msgs)
      // Scroll to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })

    return () => unsub()
  }, [selectedUser, myUid])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputText.trim() || !selectedUser) return

    try {
      await sendMessage({
        ownerId,
        fromUser: { id: myUid, name: user.name },
        toUser: { id: selectedUser.id, name: selectedUser.name },
        text: inputText
      })
      setInputText('')
    } catch (err) {
      console.error('Error sending message', err)
    }
  }

  // Helper to get unread count for a specific colleague
  const getUnreadCount = (otherUserId) => {
      const chatId = getChatId(myUid, otherUserId)
      const chat = userChats.find(c => c.id === chatId)
      return chat?.unreadCounts?.[myUid] || 0
  }

  // Helper to get last message timestamp
  const getLastMessageAt = (otherUserId) => {
      const chatId = getChatId(myUid, otherUserId)
      const chat = userChats.find(c => c.id === chatId)
      return chat?.lastMessageAt ? (chat.lastMessageAt.toMillis ? chat.lastMessageAt.toMillis() : (chat.lastMessageAt.toDate ? chat.lastMessageAt.toDate().getTime() : 0)) : 0
  }

  // Helper to get last message
  const getLastMessage = (otherUserId) => {
      const chatId = getChatId(myUid, otherUserId)
      const chat = userChats.find(c => c.id === chatId)
      return chat?.lastMessage || ''
  }

  // Helper to get online status
  const getOnlineStatus = (lastSeenTimestamp) => {
      if (!lastSeenTimestamp) return false
      const now = Date.now()
      const lastSeen = lastSeenTimestamp.toDate ? lastSeenTimestamp.toDate().getTime() : 0
      // Consider online if seen in last 2 minutes
      return (now - lastSeen) < 2 * 60 * 1000
  }

  // Sort colleagues by last message time (descending)
  const sortedColleagues = React.useMemo(() => {
    return [...colleagues].sort((a, b) => {
        const timeA = getLastMessageAt(a.id)
        const timeB = getLastMessageAt(b.id)
        // If times are equal (or both 0), sort alphabetically or keep order
        if (timeA === timeB) return 0
        return timeB - timeA // Newest first
    })
  }, [colleagues, userChats])

  // Play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled) return
    try {
        const audio = new Audio(notificationSound)
        audio.volume = 0.5
        audio.play().catch(e => console.error('Error playing sound', e))
    } catch (e) {
        console.error('Audio error', e)
    }
  }

  // Total unread count
  const totalUnread = userChats.reduce((acc, chat) => acc + (chat.unreadCounts?.[myUid] || 0), 0)

  // Monitor unread count for sound
  const prevUnreadRef = useRef(totalUnread)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
        mountedRef.current = true
        prevUnreadRef.current = totalUnread
        return
    }
    // Only play if unread count INCREASED
    if (totalUnread > prevUnreadRef.current) {
        playNotificationSound()
    }
    prevUnreadRef.current = totalUnread
  }, [totalUnread])



  // Auto-select removed to prevent auto-marking as read
  // User must explicitly select a chat


  if (!user) return null

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[800px] max-w-[90vw] h-[500px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-200 dark:border-gray-700">
          
          {/* Sidebar (User List) */}
          <div className="w-full md:w-1/3 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between">
              <span>Funcionários</span>
              <button 
                onClick={toggleSound}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                title={soundEnabled ? "Desativar sons" : "Ativar sons"}
              >
                {soundEnabled ? (
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                     <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                   </svg>
                ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                     <line x1="23" y1="9" x2="17" y2="15"></line>
                     <line x1="17" y1="9" x2="23" y2="15"></line>
                   </svg>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sortedColleagues.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">Nenhum outro funcionário encontrado.</div>
              ) : (
                sortedColleagues.map(u => {
                  const unread = getUnreadCount(u.id)
                  const lastMessage = getLastMessage(u.id)
                  const isOnline = getOnlineStatus(u.lastSeen)
                  return (
                  <div 
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={clsx(
                      "p-3 cursor-pointer flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                      selectedUser?.id === u.id && "bg-white dark:bg-gray-800 border-l-4 border-green-500 shadow-sm"
                    )}
                  >
                    <div className="relative w-10 h-10 shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-200 font-bold">
                        {u.name?.charAt(0).toUpperCase()}
                        </div>
                        {/* Online/Offline Dot */}
                        <div className={clsx(
                            "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900",
                            isOnline ? "bg-green-500" : "bg-gray-400"
                        )} title={isOnline ? "Online" : "Offline"} />
                    </div>
                    
                    <div className="overflow-hidden flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{u.name}</div>
                        <span className="text-[10px] text-gray-400 ml-1">{isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{lastMessage || u.role || 'Funcionário'}</div>
                    </div>
                    {unread > 0 && (
                        <div className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0">
                            {unread > 9 ? '9+' : unread}
                        </div>
                    )}
                  </div>
                )})
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="w-full md:w-2/3 flex flex-col bg-white dark:bg-gray-800">
            {selectedUser ? (
              <>
                {/* Header */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-700 dark:text-green-300 font-bold text-sm">
                        {selectedUser.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-gray-100">{selectedUser.name}</span>
                  </div>
                  <button onClick={() => { setIsOpen(false); setSelectedUser(null); }} className="md:hidden text-gray-500">✕</button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-[#0b1320]">
                  {messages.map(msg => {
                    const isMe = msg.fromId === myUid
                    return (
                      <div key={msg.id} className={clsx("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={clsx(
                          "max-w-[70%] rounded-lg px-4 py-2 text-sm shadow-sm",
                          isMe 
                            ? "bg-green-600 text-white rounded-tr-none" 
                            : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none border dark:border-gray-600"
                        )}>
                          <div>{msg.text}</div>
                          <div className={clsx("text-[10px] mt-1 text-right", isMe ? "text-green-100" : "text-gray-400")}>
                            {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <button 
                    type="submit"
                    disabled={!inputText.trim()}
                    className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    ➤
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-2">
                <span className="text-4xl">💬</span>
                <span>Selecione um funcionário para conversar</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <div className="relative">
        {totalUnread > 0 && !isOpen && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 z-[60] pointer-events-none">
                {totalUnread > 9 ? '9+' : totalUnread}
            </div>
        )}
        <button
            onClick={() => {
                if (isOpen) setSelectedUser(null)
                setIsOpen(!isOpen)
            }}
            className="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-50"
            title="Chat da Equipe"
        >
            {isOpen ? (
                <span className="text-2xl font-bold">✕</span>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            )}
        </button>
      </div>
    </div>
  )
}
