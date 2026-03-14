'use client'

import { useState } from 'react'
import AddKolModal from './AddKolModal'

export default function AddKolButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + 添加 KOL
      </button>
      {open && <AddKolModal onClose={() => setOpen(false)} />}
    </>
  )
}
