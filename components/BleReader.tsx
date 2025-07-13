"use client";
import React, { useState, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { processEegData } from "@/lib/eegUtils";

const SERVICE_UUID = "0338ff7c-6251-4029-a5d5-24e4fa856c8d";
const CHARACTERISTIC_UUID = "ad615f2b-cc93-4155-9e4d-f5f32cb9a2d7";

const SESSION_DURATION = 15; // 15 seconds for debug

type BleState = "idle" | "scanning" | "connecting" | "connected" | "error";
type Stage = "focus" | "non-focus";

interface EegDatum {
  value: number;
  timestamp: number;
  stage: Stage | null;
}

interface StageData {
  stageName: Stage;
  stageOrder: number;
  startTime: number;
  endTime: number;
  eegData: EegDatum[];
}

export default function BleReader() {
  const [bleState, setBleState] = useState<BleState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [participant, setParticipant] = useState("");
  const [participantSaved, setParticipantSaved] = useState(false);
  const [data, setData] = useState<EegDatum[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [stageHistory, setStageHistory] = useState<StageData[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [timer, setTimer] = useState(SESSION_DURATION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stageStartTimeRef = useRef<number | null>(null);
  const stageOrderRef = useRef<number>(1);
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [initialStage, setInitialStage] = useState<Stage | null>(null);

  // Start session timer
  const startSession = () => {
    setSessionActive(true);
    setSessionEnded(false);
    setTimer(SESSION_DURATION);
    stageOrderRef.current = 1;
    stageStartTimeRef.current = Date.now();
    setStageHistory([]);
    setData([]);
    setCurrentStage(initialStage); // Use selected initial stage
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          endSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // End session
  const endSession = () => {
    setSessionActive(false);
    setSessionEnded(true);
    setIsStreaming(false);
    setBleState("idle");
    if (timerRef.current) clearInterval(timerRef.current);
    // Save last stage if active
    if (currentStage && stageStartTimeRef.current) {
      const stageEnd = Date.now();
      const stageData = data.filter(d => d.timestamp >= stageStartTimeRef.current!);
      setStageHistory((prev) => [
        ...prev,
        {
          stageName: currentStage,
          stageOrder: stageOrderRef.current,
          startTime: stageStartTimeRef.current!,
          endTime: stageEnd,
          eegData: stageData,
        },
      ]);
    }
  };

  // Switch stage
  const handleStage = (stage: Stage) => {
    if (!sessionActive) return;
    if (currentStage && stageStartTimeRef.current) {
      // Save previous stage
      const stageEnd = Date.now();
      const stageData = data.filter(d => d.timestamp >= stageStartTimeRef.current!);
      setStageHistory((prev) => [
        ...prev,
        {
          stageName: currentStage,
          stageOrder: stageOrderRef.current,
          startTime: stageStartTimeRef.current!,
          endTime: stageEnd,
          eegData: stageData,
        },
      ]);
      stageOrderRef.current += 1;
    }
    setCurrentStage(stage);
    stageStartTimeRef.current = Date.now();
  };

  // Connect to BLE device
  const connect = async () => {
    setError(null);
    setBleState("scanning");
    setDeviceName(null);
    setData([]);
    setIsStreaming(false);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
      setDeviceName(device.name || device.id);
      setBleState("connecting");
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      characteristicRef.current = characteristic;
      setBleState("connected");
      setIsStreaming(true);
      characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleNotification);
      device.addEventListener("gattserverdisconnected", () => {
        setBleState("idle");
        setIsStreaming(false);
      });
    } catch (err: any) {
      setError(err.message || String(err));
      setBleState("error");
    }
  };

  // Handle incoming BLE notifications
  const handleNotification = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    const decoder = new TextDecoder("utf-8");
    const str = decoder.decode(value.buffer);
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
      setData((prev) => [
        ...prev.slice(-99),
        { value: num, timestamp: Date.now(), stage: currentStage },
      ]);
    }
  };

  // Disconnect
  const disconnect = async () => {
    setIsStreaming(false);
    setBleState("idle");
    setDeviceName(null);
    setData([]);
    if (characteristicRef.current) {
      try {
        characteristicRef.current.removeEventListener("characteristicvaluechanged", handleNotification);
        const device = characteristicRef.current.service.device;
        if (device.gatt?.connected) {
          await device.gatt.disconnect();
        }
      } catch {}
    }
  };

  // Prevent accidental refresh/close while streaming
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isStreaming) {
        e.preventDefault();
        e.returnValue = "Streaming is active. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    if (isStreaming) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isStreaming]);

  // Save participant name before starting
  const handleSaveParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (participant.trim()) setParticipantSaved(true);
  };

  // UI
  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow mt-8 dark:bg-gray-900 dark:border-gray-800 dark:shadow-lg">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 dark:text-white">
        Bluetooth EEG Reader
        <span className="inline-block w-2 h-2 rounded-full ml-2" style={{ background: bleState === "connected" ? "#22c55e" : bleState === "error" ? "#ef4444" : "#a3a3a3" }}></span>
      </h2>
      {!participantSaved ? (
        <form onSubmit={handleSaveParticipant} className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Enter participant name"
            value={participant}
            onChange={e => setParticipant(e.target.value)}
            className="flex-1 px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-700"
            required
          />
          <Button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition dark:bg-purple-800 dark:hover:bg-purple-700">Save</Button>
        </form>
      ) : null}
      {participantSaved && bleState === "idle" && !sessionActive && !sessionEnded && (
        <Button onClick={connect} className="mb-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition dark:bg-purple-800 dark:hover:bg-purple-700">Connect to EEG Device</Button>
      )}
      {participantSaved && bleState === "connected" && !sessionActive && !sessionEnded && (
        <>
          <div className="mb-4 flex gap-2">
            <Button
              onClick={() => setInitialStage("focus")}
              className={`px-3 py-1 rounded ${initialStage === "focus" ? "bg-green-600 text-white" : "bg-gray-200 dark:bg-gray-700 dark:text-gray-100"}`}
            >
              Start as Focus
            </Button>
            <Button
              onClick={() => setInitialStage("non-focus")}
              className={`px-3 py-1 rounded ${initialStage === "non-focus" ? "bg-red-600 text-white" : "bg-gray-200 dark:bg-gray-700 dark:text-gray-100"}`}
            >
              Start as Non-Focus
            </Button>
          </div>
          <Button
            onClick={startSession}
            className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            disabled={!initialStage}
          >
            Start Session
          </Button>
        </>
      )}
      {sessionActive && (
        <div className="mb-4 flex items-center gap-4">
          <span className="font-medium dark:text-gray-200">Time Left:</span>
          <span className="text-lg font-mono text-purple-300">{Math.floor(timer/60).toString().padStart(2,'0')}:{(timer%60).toString().padStart(2,'0')}</span>
        </div>
      )}
      {participantSaved && (
        <div className="mb-4 flex items-center gap-4">
          <span className="font-medium dark:text-gray-200">Participant:</span>
          <span className="text-purple-400 font-mono">{participant}</span>
        </div>
      )}
      {sessionActive && (
        <div className="mb-4 flex gap-2">
          <Button onClick={() => handleStage("focus")}
            className={`px-3 py-1 rounded ${currentStage === "focus" ? "bg-green-600 text-white" : "bg-gray-200 dark:bg-gray-700 dark:text-gray-100"}`}>Focus</Button>
          <Button onClick={() => handleStage("non-focus")}
            className={`px-3 py-1 rounded ${currentStage === "non-focus" ? "bg-red-600 text-white" : "bg-gray-200 dark:bg-gray-700 dark:text-gray-100"}`}>Non-Focus</Button>
        </div>
      )}
      {bleState === "scanning" && <p>Scanning for device...</p>}
      {bleState === "connecting" && <p>Connecting...</p>}
      {bleState === "connected" && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Connected to:</span>
            <span className="text-purple-700 font-mono dark:text-purple-300">{deviceName}</span>
              <Button onClick={disconnect} className="ml-4 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100">Disconnect</Button>
          </div>
          <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">Streaming EEG data...</div>
        </>
      )}
      {bleState === "error" && (
        <div className="text-red-600 mb-2 dark:text-red-400">Error: {error}</div>
      )}
      <div className="mt-4">
        <h3 className="font-semibold mb-2 dark:text-gray-200">EEG Data (Live)</h3>
        <div className="h-48 bg-gray-50 border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="timestamp" tick={false} axisLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#aaa" }} width={40} />
              <Tooltip contentStyle={{ background: "#222", border: "none", color: "#fff" }} labelFormatter={() => ""} />
              <Line type="monotone" dataKey="value" stroke="#a78bfa" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {sessionEnded && (
        <div className="mt-6 p-4 bg-gray-800 rounded text-gray-100">
          <h3 className="font-bold mb-2">Session Complete!</h3>
          <div>Stages recorded: {stageHistory.length}</div>
          <div className="mt-2 text-xs text-gray-400">(Ready to save to backend)</div>
          <div className="mt-4">
            {stageHistory.map((stage, i) => {
              const samples = stage.eegData.map(d => d.value);
              const result = processEegData(participant, samples);
              return (
                <div key={i} className="mb-2 p-2 rounded bg-gray-900">
                  <div className="font-semibold">Stage {stage.stageOrder}: {stage.stageName}</div>
                  <div>Focus Level: {result.focus_level ?? "-"}</div>
                  <div>Beta Power: {result.beta_power?.toFixed(3) ?? "-"}</div>
                  <div>Low Beta Warning: {result.low_beta_warning ? "Yes" : "No"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 