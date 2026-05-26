/* ============================================================
   DB.JS — Camada de Abstração Firebase Firestore
   Executiva Agronegócios — Sistema de Gestão de Pneus
   
   ▸ Substitui localStorage por Firestore
   ▸ Mantém cache local para performance (leitura rápida)
   ▸ Compatível com a API getData/saveData já usada no app.js
   ▸ Sincronização em tempo real via onSnapshot
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, setDoc,
  deleteDoc, onSnapshot, writeBatch, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ─── CONFIGURAÇÃO DO FIREBASE ─────────────────────────────
   Preencha com os dados do seu projeto Firebase.
   Obtenha em: console.firebase.google.com → Configurações do projeto
────────────────────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyAKogm28zKlCdiWq7SG_gHhLg9mMbDtudo",
  authDomain: "gestao-de-pneus-executiva.firebaseapp.com",
  projectId: "gestao-de-pneus-executiva",
  storageBucket: "gestao-de-pneus-executiva.firebasestorage.app",
  messagingSenderId: "552244204927",
  appId: "1:552244204927:web:ef804932569842852eb64a",
  measurementId: "G-C61ZVP0DLV"
};

/* ─── INICIALIZAÇÃO ─────────────────────────────────────── */
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

/* ─── CACHE LOCAL (evita leituras desnecessárias) ──────── */
const _cache = {};

/* ─── MAPEAMENTO: chave localStorage → coleção Firestore ── */
const COLECOES = {
  pneus:            'pneus',
  movimentacoes:    'movimentacoes',
  veiculos:         'veiculos',
  motoristas:       'motoristas',
  recapagens_custos:'recapagens_custos'
};

/* ─── FUNÇÕES PRINCIPAIS (substituem localStorage) ─────── */

/**
 * Busca todos os documentos de uma coleção.
 * Usa cache para leitura rápida após o primeiro carregamento.
 * @param {string} colecao  — nome da coleção (ex: 'pneus')
 * @returns {Array}
 */
export async function getData(colecao) {
  if (_cache[colecao]) return _cache[colecao];
  try {
    const snap = await getDocs(collection(db, colecao));
    const dados = snap.docs.map(d => ({ ...d.data() }));
    _cache[colecao] = dados;
    return dados;
  } catch (e) {
    console.error(`[DB] Erro ao ler '${colecao}':`, e);
    return [];
  }
}

/**
 * Salva (substitui) toda a lista de uma coleção no Firestore.
 * Usa batch write para eficiência. Cada item precisa ter um campo 'id'.
 * @param {string} colecao
 * @param {Array}  dados
 */
export async function saveData(colecao, dados) {
  try {
    // Deleta documentos removidos
    const snapAtual = await getDocs(collection(db, colecao));
    const idsNovos  = new Set(dados.map(d => d.id));
    const batch1    = writeBatch(db);
    snapAtual.docs.forEach(d => {
      if (!idsNovos.has(d.id)) batch1.delete(d.ref);
    });
    await batch1.commit();

    // Salva / atualiza documentos atuais (em lotes de 500)
    const chunks = [];
    for (let i = 0; i < dados.length; i += 400) chunks.push(dados.slice(i, i + 400));
    for (const chunk of chunks) {
      const batch2 = writeBatch(db);
      chunk.forEach(item => {
        const ref = doc(db, colecao, String(item.id));
        batch2.set(ref, item, { merge: true });
      });
      await batch2.commit();
    }

    _cache[colecao] = dados; // atualiza cache
    console.log(`[DB] '${colecao}' salvo (${dados.length} registros)`);
  } catch (e) {
    console.error(`[DB] Erro ao salvar '${colecao}':`, e);
    throw e;
  }
}

/**
 * Invalida o cache de uma (ou todas) coleção para forçar releitura.
 * @param {string|null} colecao — null limpa todo o cache
 */
export function invalidarCache(colecao = null) {
  if (colecao) delete _cache[colecao];
  else Object.keys(_cache).forEach(k => delete _cache[k]);
}

/* ─── LISTENER EM TEMPO REAL ────────────────────────────── */

/**
 * Escuta mudanças em tempo real de uma coleção.
 * Útil para o Dashboard mostrar dados atualizados automaticamente.
 * @param {string}   colecao
 * @param {Function} callback  — chamado com array de dados quando há mudança
 * @returns {Function} unsubscribe — chame para parar de escutar
 */
export function escutarColecao(colecao, callback) {
  const unsubscribe = onSnapshot(collection(db, colecao), snap => {
    const dados = snap.docs.map(d => ({ ...d.data() }));
    _cache[colecao] = dados;
    callback(dados);
  }, err => console.error(`[DB] Listener '${colecao}':`, err));
  return unsubscribe;
}

/* ─── AUTENTICAÇÃO ─────────────────────────────────────── */

/**
 * Faz login com email e senha.
 * @returns {Promise<UserCredential>}
 */
export async function fazerLogin(email, senha) {
  return signInWithEmailAndPassword(auth, email, senha);
}

/**
 * Faz logout do Firebase Auth.
 */
export async function fazerLogout() {
  await signOut(auth);
  window.location.href = 'login.html';
}

/**
 * Observa o estado de autenticação.
 * @param {Function} callback — chamado com (user) quando muda
 */
export function observarAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Retorna o usuário atual ou null.
 */
export function getUsuarioAtual() {
  return auth.currentUser;
}

/* ─── MIGRAÇÃO: localStorage → Firestore ───────────────── */

/**
 * Migra todos os dados do localStorage para o Firestore.
 * Execute UMA VEZ após configurar o Firebase.
 * Mostra progresso no console.
 */
export async function migrarLocalStorageParaFirebase() {
  const chaves = Object.keys(COLECOES);
  let totalMigrado = 0;

  for (const chave of chaves) {
    try {
      const raw = localStorage.getItem(chave);
      if (!raw) { console.log(`[MIGRAÇÃO] '${chave}' — vazio, pulando`); continue; }
      const dados = JSON.parse(raw);
      if (!Array.isArray(dados) || dados.length === 0) { console.log(`[MIGRAÇÃO] '${chave}' — sem dados`); continue; }

      console.log(`[MIGRAÇÃO] Migrando '${chave}' (${dados.length} registros)...`);
      await saveData(COLECOES[chave], dados);
      totalMigrado += dados.length;
      console.log(`[MIGRAÇÃO] ✅ '${chave}' migrado!`);
    } catch (e) {
      console.error(`[MIGRAÇÃO] ❌ Erro em '${chave}':`, e);
    }
  }
  console.log(`[MIGRAÇÃO] ✅ Concluído! Total: ${totalMigrado} registros migrados.`);
  return totalMigrado;
}

/* ─── EXPORTAÇÕES PARA COMPATIBILIDADE ─────────────────── */
export { db, auth };
