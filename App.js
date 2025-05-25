
import React, { useState, useEffect, useCallback } from 'react';
import { APP_TITLE, DEFAULT_SUPERMARKET, LOCAL_STORAGE_KEYS } from './constants.js';
import { AppPhase } from './types.js';
import PlusIcon from './components/icons/PlusIcon.js';
import TrashIcon from './components/icons/TrashIcon.js';
import ArrowRightCircleIcon from './components/icons/ArrowRightCircleIcon.js';
import ArrowLeftCircleIcon from './components/icons/ArrowLeftCircleIcon.js';

const App = () => {
  const [RechartsAPI, setRechartsAPI] = useState(null);
  const [rechartsLoadStatus, setRechartsLoadStatus] = useState('loading'); // 'loading', 'loaded', 'failed'

  const [currentPhase, setCurrentPhase] = useState(() => {
    const savedPhase = localStorage.getItem(LOCAL_STORAGE_KEYS.APP_PHASE);
    return savedPhase ? JSON.parse(savedPhase) : AppPhase.BUDGET_SETUP;
  });
  const [supermarket, setSupermarket] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.SUPERMARKET) || DEFAULT_SUPERMARKET;
  });
  const [budget, setBudget] = useState(() => {
    const savedBudget = localStorage.getItem(LOCAL_STORAGE_KEYS.BUDGET);
    return savedBudget ? parseFloat(savedBudget) : null;
  });
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);

  const [shoppingList, setShoppingList] = useState(() => {
    const savedList = localStorage.getItem(LOCAL_STORAGE_KEYS.SHOPPING_LIST);
    return savedList ? JSON.parse(savedList) : [];
  });
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem(LOCAL_STORAGE_KEYS.CART);
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [priceHistory, setPriceHistory] = useState(() => {
    const savedHistory = localStorage.getItem(LOCAL_STORAGE_KEYS.PRICE_HISTORY);
    return savedHistory ? JSON.parse(savedHistory) : {};
  });
  const [purchaseFinalizedMessage, setPurchaseFinalizedMessage] = useState('');


  useEffect(() => {
    setRechartsLoadStatus('loading');
    let attempts = 0;
    const maxAttempts = 100;
    const intervalTime = 100;

    const intervalId = setInterval(() => {
      if (window.Recharts && window.Recharts.PieChart) {
        setRechartsAPI(window.Recharts);
        setRechartsLoadStatus('loaded');
        clearInterval(intervalId);
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          setRechartsLoadStatus('failed');
          clearInterval(intervalId);
        }
      }
    }, intervalTime);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.APP_PHASE, JSON.stringify(currentPhase));
  }, [currentPhase]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SUPERMARKET, supermarket);
  }, [supermarket]);

  useEffect(() => {
    if (budget === null) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.BUDGET);
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEYS.BUDGET, budget.toString());
    }
  }, [budget]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SHOPPING_LIST, JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CART, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.PRICE_HISTORY, JSON.stringify(priceHistory));
  }, [priceHistory]);


  const handleStartShopping = () => {
    if (budget && budget > 0 && supermarket.trim() !== '') {
      setCurrentPhase(AppPhase.SHOPPING);
      setPurchaseFinalizedMessage('');
    } else {
      alert("Por favor, defina um supermercado e orçamento válidos.");
    }
  };

  const getPriceInsights = useCallback((itemName, currentSupermarket) => {
    const insights = {}; // Plain object, properties added dynamically
    const normalizedItemName = itemName.toLowerCase().trim();

    if (priceHistory[currentSupermarket] && priceHistory[currentSupermarket][normalizedItemName] !== undefined) {
      insights.lastPurchasePrice = priceHistory[currentSupermarket][normalizedItemName];
    }

    let bestPrice; // undefined initially
    let bestSupermarketName; // undefined initially

    for (const market in priceHistory) {
      if (priceHistory[market][normalizedItemName] !== undefined) {
        const currentMarketPrice = priceHistory[market][normalizedItemName];
        if (bestPrice === undefined || currentMarketPrice < bestPrice) {
          bestPrice = currentMarketPrice;
          bestSupermarketName = market;
        }
      }
    }

    if (bestPrice !== undefined && bestSupermarketName !== undefined) {
      insights.bestOverallPrice = { price: bestPrice, supermarket: bestSupermarketName };
    }
    return insights;
  }, [priceHistory, supermarket]); // Added supermarket to dependency array

  const handleAddItemToList = () => {
    if (!newItemName.trim() || newItemQuantity <= 0 || newItemPrice < 0) {
      alert("Por favor, insira detalhes válidos para o item.");
      return;
    }
    const trimmedItemName = newItemName.trim();
    const priceInsights = getPriceInsights(trimmedItemName, supermarket);

    const newItem = {
      id: crypto.randomUUID(),
      name: trimmedItemName,
      quantity: newItemQuantity,
      price: newItemPrice,
      ...priceInsights,
    };
    setShoppingList(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemPrice(0);
  };

  const removeItemFromList = (itemId) => {
    setShoppingList(prev => prev.filter(item => item.id !== itemId));
  };

  const removeItemFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };
  
  const recordPriceHistory = (itemName, itemPrice, market) => {
    const normalizedItemName = itemName.toLowerCase().trim();
    setPriceHistory(prevHistory => ({
      ...prevHistory,
      [market]: {
        ...(prevHistory[market] || {}),
        [normalizedItemName]: itemPrice,
      }
    }));
  };

  const moveToCart = (item) => {
    setCart(prev => [...prev, item]);
    removeItemFromList(item.id);
    recordPriceHistory(item.name, item.price, supermarket);
  };

  const moveToList = (item) => {
    const priceInsights = getPriceInsights(item.name, supermarket);
    const itemWithUpdatedInsights = { ...item, ...priceInsights };
    setShoppingList(prev => [...prev, itemWithUpdatedInsights]);
    removeItemFromCart(item.id);
  };

  const updateItemInList = (itemId, newQuantity, newPrice) => {
    setShoppingList(prevList => prevList.map(item => {
      if (item.id === itemId) {
        const updatedItem = {
          ...item,
          quantity: newQuantity !== undefined ? Math.max(1, newQuantity) : item.quantity,
          price: newPrice !== undefined ? Math.max(0, newPrice) : item.price,
        };
        if (newPrice !== undefined) {
            const priceInsights = getPriceInsights(updatedItem.name, supermarket);
            return { ...updatedItem, ...priceInsights};
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const updateItemInCart = (itemId, newQuantity, newPrice) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === itemId) {
        const updatedItem = {
          ...item,
          quantity: newQuantity !== undefined ? Math.max(1, newQuantity) : item.quantity,
          price: newPrice !== undefined ? Math.max(0, newPrice) : item.price,
        };
        if (newPrice !== undefined) {
          recordPriceHistory(updatedItem.name, updatedItem.price, supermarket);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const handleFinalizePurchase = () => {
    if (cart.length === 0) {
      alert("Seu carrinho está vazio. Adicione itens antes de finalizar.");
      return;
    }
    const finalCartTotal = calculateTotal(cart);
    setPurchaseFinalizedMessage(`Compra finalizada!\nTotal: R$${finalCartTotal.toFixed(2)}\nItens: ${cart.length}`);
    setCart([]);
  };

  const handleStartNewPurchase = () => {
    setShoppingList([]);
    setCart([]);
    setBudget(null);
    setSupermarket(DEFAULT_SUPERMARKET);
    setCurrentPhase(AppPhase.BUDGET_SETUP);
    setPurchaseFinalizedMessage('');
  };

  const calculateTotal = useCallback((items) => {
    return items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, []);

  const shoppingListTotal = calculateTotal(shoppingList);
  const cartTotal = calculateTotal(cart);
  const remainingBudget = budget !== null ? budget - cartTotal : null;

  const budgetPieData = budget !== null ? [
    { name: 'Gasto (Carrinho)', value: cartTotal, fill: '#ef4444' }, // red-500
    { name: 'Restante Orçamento', value: Math.max(0, remainingBudget || 0), fill: '#22c55e' } // green-500
  ] : [];
  
  const shoppingListPieData = budget !== null ? [
      { name: 'Planejado (Lista)', value: shoppingListTotal, fill: '#3b82f6' }, // blue-500
      { name: 'Saldo p/ Lista', value: Math.max(0, (budget || 0) - shoppingListTotal), fill: '#6b7280' } // gray-500
  ] : [];

  const renderPriceInsight = (item) => {
    const insightsElements = [];
    const currentItemPrice = item.price;

    if (item.lastPurchasePrice !== undefined) {
        let comparisonText = "";
        let textColor = "text-yellow-400";
        if (currentItemPrice > item.lastPurchasePrice) {
            comparisonText = ` (Atual: +R$${(currentItemPrice - item.lastPurchasePrice).toFixed(2)})`;
            textColor = "text-red-400";
        } else if (currentItemPrice < item.lastPurchasePrice) {
            comparisonText = ` (Atual: -R$${(item.lastPurchasePrice - currentItemPrice).toFixed(2)})`;
            textColor = "text-green-400";
        } else {
            comparisonText = " (Atual: Mesmo preço)";
        }
        insightsElements.push(
            React.createElement('p', { key: "last-price", className: `text-xs ${textColor}` },
                `Últ. compra aqui: R$${item.lastPurchasePrice.toFixed(2)}${comparisonText}`
            )
        );
    }

    if (item.bestOverallPrice) {
        let bestPriceText = `Melhor preço conhecido: R$${item.bestOverallPrice.price.toFixed(2)}`;
        let marketText = item.bestOverallPrice.supermarket === supermarket ? " (aqui neste mercado)" : ` (em ${item.bestOverallPrice.supermarket})`;
        let comparisonHighlight = "";
        let textColor = item.bestOverallPrice.supermarket === supermarket ? "text-sky-300" : "text-sky-400";

        if (currentItemPrice === item.bestOverallPrice.price) {
            comparisonHighlight = " ⭐ Preço atual é o melhor!";
            textColor = "text-emerald-400";
        } else if (currentItemPrice < item.bestOverallPrice.price) {
            comparisonHighlight = " 🎉 Novo melhor preço!";
             textColor = "text-amber-400";
        } else if (currentItemPrice > item.bestOverallPrice.price) {
             comparisonHighlight = ` (Atual: +R$${(currentItemPrice - item.bestOverallPrice.price).toFixed(2)})`;
        }
        
        insightsElements.push(
            React.createElement('p', { key: "best-price", className: `text-xs ${textColor}` },
                `${bestPriceText}${marketText}${comparisonHighlight}`
            )
        );
    }

    if (insightsElements.length === 0) {
        insightsElements.push(React.createElement('p', { key: "no-history", className: "text-xs text-gray-500 italic" }, "Sem histórico de preços para este item."));
    }
    return insightsElements;
  };

  if (currentPhase === AppPhase.BUDGET_SETUP) {
    return (
      React.createElement('div', { className: "min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4" },
        React.createElement('div', { className: "bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md" },
          React.createElement('h1', { className: "text-4xl font-bold text-center text-emerald-400 mb-8" }, APP_TITLE),
          React.createElement('div', { className: "space-y-6" },
            React.createElement('div', null,
              React.createElement('label', { htmlFor: "supermarket", className: "block text-sm font-medium text-gray-300 mb-1" }, "Supermercado"),
              React.createElement('input', {
                type: "text",
                id: "supermarket",
                value: supermarket,
                onChange: (e) => setSupermarket(e.target.value),
                placeholder: "Ex: Mercado Central",
                className: "w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors",
                "aria-label": "Nome do Supermercado"
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { htmlFor: "budget", className: "block text-sm font-medium text-gray-300 mb-1" }, "Orçamento para Compras (R$)"),
              React.createElement('input', {
                type: "number",
                id: "budget",
                value: budget === null ? '' : budget,
                onChange: (e) => setBudget(e.target.value === '' ? null : parseFloat(e.target.value)),
                placeholder: "Ex: 150",
                className: "w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors",
                "aria-label": "Valor do Orçamento para Compras"
              })
            ),
            React.createElement('button', {
              onClick: handleStartShopping,
              disabled: !budget || budget <= 0 || supermarket.trim() === '',
              className: "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "aria-label": "Iniciar Compras"
            }, "Iniciar Compras")
          )
        )
      )
    );
  }

  return (
    React.createElement('div', { className: "min-h-screen bg-gray-900 text-gray-100 p-4 md:p-6" },
      React.createElement('header', { className: "mb-6 flex flex-col items-center" },
        React.createElement('h1', { className: "text-3xl md:text-4xl font-bold text-emerald-400 text-center" }, APP_TITLE),
        React.createElement('div', { className: "text-center text-gray-400 text-lg mt-2" },
            `Mercado: `, React.createElement('span', { className: "font-semibold text-emerald-300" }, supermarket), ` | Orçamento: `, React.createElement('span', { className: "font-semibold text-emerald-300" }, `R$${budget?.toFixed(2)}`)
        ),
        React.createElement('button', {
            onClick: () => setCurrentPhase(AppPhase.BUDGET_SETUP),
            className: "mt-2 text-sm text-emerald-400 hover:text-emerald-300 underline",
            "aria-label": "Editar orçamento ou supermercado"
        }, "Editar Orçamento/Mercado")
      ),
      React.createElement('div', { className: "grid grid-cols-1 lg:grid-cols-3 gap-6" },
        React.createElement('section', { "aria-labelledby": "add-item-heading", className: "lg:col-span-1 bg-gray-800 p-6 rounded-xl shadow-xl" },
          React.createElement('h2', { id: "add-item-heading", className: "text-2xl font-semibold text-emerald-400 mb-4" }, "Adicionar Item à Lista"),
          React.createElement('div', { className: "space-y-4" },
            React.createElement('div', null,
              React.createElement('label', { htmlFor: "itemName", className: "block text-sm font-medium text-gray-300 mb-1" }, "Nome do Produto"),
              React.createElement('input', { type: "text", id: "itemName", value: newItemName, onChange: e => setNewItemName(e.target.value), placeholder: "Ex: Maçãs", className: "w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"})
            ),
            React.createElement('div', { className: "grid grid-cols-2 gap-4" },
              React.createElement('div', null,
                React.createElement('label', { htmlFor: "itemQuantity", className: "block text-sm font-medium text-gray-300 mb-1" }, "Quantidade"),
                React.createElement('input', { type: "number", id: "itemQuantity", value: newItemQuantity, onChange: e => setNewItemQuantity(parseInt(e.target.value)), min: "1", className: "w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"})
              ),
              React.createElement('div', null,
                React.createElement('label', { htmlFor: "itemPrice", className: "block text-sm font-medium text-gray-300 mb-1" }, "Preço Unit. (R$)"),
                React.createElement('input', { type: "number", id: "itemPrice", value: newItemPrice, onChange: e => setNewItemPrice(parseFloat(e.target.value)), min: "0", step: "0.01", className: "w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"})
              )
            ),
            React.createElement('button', { onClick: () => alert("Leitor de código de barras ainda não implementado."), className: "w-full text-emerald-400 hover:text-emerald-300 border border-emerald-500 hover:border-emerald-400 py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2" },
              React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "w-5 h-5" }, React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" })),
              React.createElement('span', null, "Escanear Código")
            ),
            React.createElement('button', { onClick: handleAddItemToList, className: "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2" },
              React.createElement(PlusIcon, null), React.createElement('span', null, "Adicionar à Lista")
            )
          ),
          budget !== null && (
            rechartsLoadStatus === 'loading' ? (
              React.createElement('p', { className: "text-gray-400 mt-6 text-center" }, "Carregando gráfico da lista...")
            ) : rechartsLoadStatus === 'failed' ? (
              React.createElement('p', { className: "text-red-400 mt-6 text-center" }, "Falha ao carregar gráfico da lista.", React.createElement('br',null), "Verifique sua conexão ou tente recarregar.")
            ) : RechartsAPI ? (
              React.createElement('div', { className: "mt-6" },
                React.createElement('h3', { className: "text-lg font-semibold text-gray-200 mb-2" }, "Visão Geral do Orçamento (Lista)"),
                React.createElement(RechartsAPI.ResponsiveContainer, { width: "100%", height: 200 },
                  React.createElement(RechartsAPI.PieChart, null,
                    React.createElement(RechartsAPI.Pie, { data: shoppingListPieData, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 60, labelLine: false, label: ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` },
                       shoppingListPieData.map((entry, index) => (
                          React.createElement(RechartsAPI.Cell, { key: `cell-list-${index}`, fill: entry.fill })
                        ))
                    ),
                    React.createElement(RechartsAPI.Tooltip, { formatter: (value, name) => [`R$${value.toFixed(2)}`, name] }),
                    React.createElement(RechartsAPI.Legend, null)
                  )
                )
              )
            ) : null
          )
        ),
        React.createElement('section', { "aria-labelledby": "shopping-list-heading", className: "lg:col-span-1 bg-gray-800 p-6 rounded-xl shadow-xl" },
          React.createElement('h2', { id: "shopping-list-heading", className: "text-2xl font-semibold text-emerald-400 mb-4" }, `Lista de Compras (${shoppingList.length})`),
          React.createElement('p', { className: "text-gray-400 mb-4" }, "Total Planejado: ", React.createElement('span', { className: "font-semibold text-emerald-300" }, `R$${shoppingListTotal.toFixed(2)}`)),
          shoppingList.length === 0 ? React.createElement('p', { className: "text-gray-500" }, "Sua lista de compras está vazia.") : (
            React.createElement('ul', { className: "space-y-3 max-h-[60vh] overflow-y-auto pr-2" },
              shoppingList.map(item => (
                React.createElement('li', { key: item.id, className: "bg-gray-700 p-4 rounded-lg shadow flex flex-col space-y-2" },
                  React.createElement('div', { className: "flex justify-between items-start" },
                    React.createElement('span', { className: "font-semibold text-lg text-gray-100" }, item.name),
                    React.createElement('div', { className: "flex space-x-2 items-center" },
                       React.createElement('button', { onClick: () => moveToCart(item), title: "Adicionar ao carrinho", className: "text-green-400 hover:text-green-300 p-1 rounded-full hover:bg-gray-600 transition-colors" },
                        React.createElement(ArrowRightCircleIcon, { className: "w-6 h-6"})
                      ),
                      React.createElement('button', { onClick: () => removeItemFromList(item.id), title: "Excluir da lista", className: "text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-gray-600 transition-colors" },
                        React.createElement(TrashIcon, { className: "w-5 h-5"})
                      )
                    )
                  ),
                  React.createElement('div', { className: "flex items-center space-x-2 text-sm" },
                      React.createElement('label', { htmlFor: `list-qty-${item.id}`, className: "text-gray-400" }, "Qtd:"),
                      React.createElement('input', {
                        type: "number",
                        id: `list-qty-${item.id}`,
                        value: item.quantity,
                        onChange: (e) => updateItemInList(item.id, parseInt(e.target.value), undefined),
                        min: "1",
                        className: "w-16 p-1 bg-gray-600 border border-gray-500 rounded text-center focus:ring-1 focus:ring-emerald-500 outline-none",
                        "aria-label": `Quantidade para ${item.name} na lista de compras`
                      }),
                      React.createElement('label', { htmlFor: `list-price-${item.id}`, className: "text-gray-400" }, "Preço:"),
                      React.createElement('input', {
                        type: "number",
                        id: `list-price-${item.id}`,
                        value: item.price,
                        onChange: (e) => updateItemInList(item.id, undefined, parseFloat(e.target.value)),
                        min: "0",
                        step: "0.01",
                        className: "w-20 p-1 bg-gray-600 border border-gray-500 rounded text-center focus:ring-1 focus:ring-emerald-500 outline-none",
                        "aria-label": `Preço para ${item.name} na lista de compras`
                      })
                  ),
                  React.createElement('p', { className: "text-xs text-gray-300" }, "Subtotal: ", React.createElement('span', { className: "font-semibold" }, `R$${(item.quantity * item.price).toFixed(2)}`)),
                  React.createElement('div', { className: "mt-1 space-y-0.5" },
                    renderPriceInsight(item)
                  )
                )
              ))
            )
          )
        ),
        React.createElement('section', { "aria-labelledby": "cart-heading", className: "lg:col-span-1 bg-gray-800 p-6 rounded-xl shadow-xl" },
          React.createElement('h2', { id: "cart-heading", className: "text-2xl font-semibold text-emerald-400 mb-4" }, `Carrinho de Compras (${cart.length})`),
           React.createElement('div', { className: "flex justify-between items-center mb-1" },
            React.createElement('p', { className: "text-gray-300" }, "Total no Carrinho: ", React.createElement('span', { className: "font-bold text-xl text-emerald-300" }, `R$${cartTotal.toFixed(2)}`)),
            budget !== null && (
              React.createElement('p', { className: `text-sm font-semibold ${remainingBudget && remainingBudget < 0 ? 'text-red-400' : 'text-green-400'}` },
                `Orçamento: R$${budget.toFixed(2)} | Restante: R$${remainingBudget?.toFixed(2)}`
              )
            )
          ),
          budget !== null && !purchaseFinalizedMessage && (
            rechartsLoadStatus === 'loading' ? (
                React.createElement('p', { className: "text-gray-400 mb-4 text-center" }, "Carregando gráfico do carrinho...")
            ) : rechartsLoadStatus === 'failed' ? (
                React.createElement('p', { className: "text-red-400 mb-4 text-center" }, "Falha ao carregar gráfico do carrinho.", React.createElement('br',null),"Verifique sua conexão ou tente recarregar.")
            ) : RechartsAPI ? (
                React.createElement('div', { className: "mb-4" },
                React.createElement(RechartsAPI.ResponsiveContainer, { width: "100%", height: 200 },
                    React.createElement(RechartsAPI.PieChart, null,
                    React.createElement(RechartsAPI.Pie, { data: budgetPieData, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 60, labelLine: false, label: ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` },
                        budgetPieData.map((entry, index) => (
                            React.createElement(RechartsAPI.Cell, { key: `cell-cart-${index}`, fill: entry.fill })
                        ))
                    ),
                    React.createElement(RechartsAPI.Tooltip, { formatter: (value, name) => [`R$${value.toFixed(2)}`, name] }),
                    React.createElement(RechartsAPI.Legend, null)
                    )
                )
                )
            ) : null
          ),
          purchaseFinalizedMessage && (
            React.createElement('div', { className: "bg-green-700 border border-green-500 text-white p-4 rounded-lg mb-4 text-center" },
              React.createElement('p', { className: "font-semibold text-lg" }, "Sucesso!"),
              React.createElement('pre', { className: "whitespace-pre-wrap" }, purchaseFinalizedMessage)
            )
          ),
          cart.length === 0 && !purchaseFinalizedMessage ? React.createElement('p', { className: "text-gray-500" }, "Seu carrinho está vazio.") : !purchaseFinalizedMessage && (
            React.createElement('ul', { className: "space-y-3 max-h-[40vh] overflow-y-auto pr-2 mb-4" },
              cart.map(item => (
                React.createElement('li', { key: item.id, className: "bg-gray-700 p-4 rounded-lg shadow flex flex-col space-y-2" },
                  React.createElement('div', { className: "flex justify-between items-start" },
                    React.createElement('span', { className: "font-semibold text-lg text-gray-100" }, item.name),
                     React.createElement('div', { className: "flex space-x-2 items-center" },
                       React.createElement('button', { onClick: () => moveToList(item), title: "Mover para lista", className: "text-yellow-400 hover:text-yellow-300 p-1 rounded-full hover:bg-gray-600 transition-colors" },
                        React.createElement(ArrowLeftCircleIcon, { className: "w-6 h-6"})
                      ),
                      React.createElement('button', { onClick: () => removeItemFromCart(item.id), title: "Excluir do carrinho", className: "text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-gray-600 transition-colors" },
                        React.createElement(TrashIcon, { className: "w-5 h-5"})
                      )
                    )
                  ),
                   React.createElement('div', { className: "flex items-center space-x-2 text-sm" },
                      React.createElement('label', { htmlFor: `cart-qty-${item.id}`, className: "text-gray-400" }, "Qtd:"),
                      React.createElement('input', {
                        type: "number",
                        id: `cart-qty-${item.id}`,
                        value: item.quantity,
                        onChange: (e) => updateItemInCart(item.id, parseInt(e.target.value), undefined),
                        min: "1",
                        className: "w-16 p-1 bg-gray-600 border border-gray-500 rounded text-center focus:ring-1 focus:ring-emerald-500 outline-none",
                        "aria-label": `Quantidade para ${item.name} no carrinho`
                      }),
                      React.createElement('label', { htmlFor: `cart-price-${item.id}`, className: "text-gray-400" }, "Preço:"),
                      React.createElement('input', {
                        type: "number",
                        id: `cart-price-${item.id}`,
                        value: item.price,
                        onChange: (e) => updateItemInCart(item.id, undefined, parseFloat(e.target.value)),
                        min: "0",
                        step: "0.01",
                        className: "w-20 p-1 bg-gray-600 border border-gray-500 rounded text-center focus:ring-1 focus:ring-emerald-500 outline-none",
                        "aria-label": `Preço para ${item.name} no carrinho`
                      })
                  ),
                  React.createElement('p', { className: "text-xs text-gray-300" }, "Subtotal: ", React.createElement('span', { className: "font-semibold" }, `R$${(item.quantity * item.price).toFixed(2)}`))
                )
              ))
            )
          ),
          !purchaseFinalizedMessage && cart.length > 0 && (
            React.createElement('button', {
              onClick: handleFinalizePurchase,
              className: "w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "aria-label": "Finalizar Compra"
            }, "Finalizar Compra")
          ),
          purchaseFinalizedMessage && (
            React.createElement('button', {
              onClick: handleStartNewPurchase,
              className: "w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "aria-label": "Iniciar Nova Compra"
            }, "Iniciar Nova Compra")
          )
        )
      )
    )
  );
};

export default App;
