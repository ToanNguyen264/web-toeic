import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import {
  LoadingScreen,
  ProtectedRoute,
  PublicOnlyRoute,
} from "./router/ProtectedRoute";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VocabularyPage = lazy(() => import("./pages/VocabularyPage"));
const FlashcardPage = lazy(() => import("./pages/FlashcardPage"));

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to="/listen" replace />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/listen"
          element={
            <ProtectedRoute>
              <VocabularyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flashcards"
          element={
            <ProtectedRoute>
              <FlashcardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/vocabularies" element={<Navigate to="/listen" replace />} />
        <Route path="*" element={<Navigate to="/listen" replace />} />
      </Routes>
    </Suspense>
  );
}
