import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';

interface CaptchaVerificationProps {
  onVerified: (isVerified: boolean) => void;
  isVerified: boolean;
}

export const CaptchaVerification: React.FC<CaptchaVerificationProps> = ({
  onVerified,
  isVerified,
}) => {
  const [num1, setNum1] = useState(3);
  const [num2, setNum2] = useState(4);
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState(false);

  const generateChallenge = () => {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 1;
    setNum1(a);
    setNum2(b);
    setUserAnswer('');
    setError(false);
    onVerified(false);
  };

  useEffect(() => {
    generateChallenge();
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const correct = num1 + num2;
    if (parseInt(userAnswer.trim(), 10) === correct) {
      setError(false);
      onVerified(true);
    } else {
      setError(true);
      onVerified(false);
    }
  };

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Bot Protection (Captcha)
        </span>
        {isVerified && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Verified
          </span>
        )}
      </div>

      {!isVerified ? (
        <form onSubmit={handleVerify} className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold tracking-wider select-none text-slate-900 shadow-2xs">
            {num1} + {num2} = ?
          </div>
          <input
            type="number"
            placeholder="Result"
            value={userAnswer}
            onChange={(e) => {
              setUserAnswer(e.target.value);
              setError(false);
            }}
            className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={generateChallenge}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            title="New challenge"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-emerald-700 font-medium">
          Human verification confirmed. You are ready to book.
        </p>
      )}

      {error && (
        <p className="text-[11px] text-rose-600 font-medium">
          Incorrect answer. Please calculate again or click refresh.
        </p>
      )}
    </div>
  );
};
