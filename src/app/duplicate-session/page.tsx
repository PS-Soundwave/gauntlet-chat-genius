"use client"

export default function DuplicateSessionPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-semibold mb-4">Session Already Active</h1>
        <p className="text-gray-600">
          You already have an active session in another window or device. 
          Please close this tab and continue using your existing session.
        </p>
      </div>
    </div>
  )
} 