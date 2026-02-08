
import React, { useState, useEffect } from 'react';
import GameHeader from '../../components/GameHeader';
import BottomNav from '../../components/BottomNav';
import Mascot from '../../components/Mascot';
import { MascotOutfit, setSelectedOutfit, getSelectedOutfit } from '../../utils/mascotUtils';
import { getShopItems, purchaseItem, getUserInventory, equipItem } from '../../utils/api';

interface Item {
  id: string;
  name: string;
  price: number;
  owned: boolean;
  outfit?: MascotOutfit;
  image?: string; // 家具图片路径
  equipped?: boolean; // 是否已装备
}

const OutfitView: React.FC = () => {
  const [category, setCategory] = useState('Clothes');
  const [activeSubTab, setActiveSubTab] = useState<'Mine' | 'Shop'>('Shop');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  
  // 获取当前穿着的服装（响应式）
  const [currentOutfit, setCurrentOutfit] = useState<MascotOutfit>(getSelectedOutfit());

  useEffect(() => {
    const handleOutfitChange = () => {
      setCurrentOutfit(getSelectedOutfit());
    };
    window.addEventListener('mascot-outfit-changed', handleOutfitChange);
    return () => window.removeEventListener('mascot-outfit-changed', handleOutfitChange);
  }, []);

  // 初始化时从后端同步当前装备
  useEffect(() => {
    const syncCurrentOutfit = async () => {
      try {
        const response = await getUserInventory('clothes');
        const equippedItem = response.inventory.find(item => item.is_equipped);
        if (equippedItem) {
          const outfit = equippedItem.name as MascotOutfit;
          setSelectedOutfit(outfit);
          setCurrentOutfit(outfit);
        }
      } catch (error) {
        console.error('Failed to sync current outfit:', error);
      }
    };
    syncCurrentOutfit();
  }, []);

  const categories = ['Clothes', 'Furniture'];

  // 从后端加载商品数据
  useEffect(() => {
    loadItems();
  }, [category, activeSubTab]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const itemType = category === 'Clothes' ? 'clothes' : 'furniture';
      
      if (activeSubTab === 'Shop') {
        // 加载商店商品
        const response = await getShopItems(itemType);
        setItems(response.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          owned: item.owned,
          // 假设衣服的 name 就是 outfit 标识符（如 'oliver_wizard', 'default' 等）
          outfit: itemType === 'clothes' ? (item.name as MascotOutfit) : undefined,
          image: item.image_path,
          equipped: item.is_equipped,
        })));
      } else {
        // 加载用户库存
        const response = await getUserInventory(itemType);
        setItems(response.inventory.map(item => ({
          id: item.item_id,
          name: item.name,
          price: 0, // Already owned, no price needed
          owned: true,
          // 假设衣服的 name 就是 outfit 标识符（如 'oliver_wizard', 'default' 等）
          outfit: itemType === 'clothes' ? (item.name as MascotOutfit) : undefined,
          image: item.image_path,
          equipped: item.is_equipped, // 保存装备状态
        })));
        
        // 同步已装备的服装到 localStorage
        if (itemType === 'clothes') {
          const equippedItem = response.inventory.find(item => item.is_equipped);
          if (equippedItem) {
            const outfit = equippedItem.name as MascotOutfit;
            setSelectedOutfit(outfit);
            setCurrentOutfit(outfit);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      // Fallback to empty list on error
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (itemId: string) => {
    setIsPurchasing(true);
    try {
      await purchaseItem({ item_id: itemId });
      
      // 刷新商品列表
      await loadItems();
      
      // 触发金币减少动画
      const item = items.find(i => i.id === itemId);
      if (item) {
        window.dispatchEvent(new CustomEvent('gold-changed', { 
          detail: { amount: -item.price } 
        }));
      }
      
      alert('Purchase successful!');
    } catch (error: any) {
      console.error('Failed to purchase item:', error);
      if (error.code === 'INSUFFICIENT_GOLD') {
        alert('Insufficient gold!');
      } else {
        alert('Purchase failed, please try again');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleEquip = async (itemId: string, outfit?: MascotOutfit) => {
    try {
      // 调用后端 API 装备
      await equipItem({ item_id: itemId, equip: true });
      
      // 同步到 localStorage（触发 Mascot 组件更新）
      if (outfit) {
        setSelectedOutfit(outfit);
        setCurrentOutfit(outfit);
      }
      
      // 刷新库存列表
      await loadItems();
    } catch (error) {
      console.error('Failed to equip item:', error);
      alert('Failed to equip, please try again');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] overflow-hidden select-none font-sans">
      <GameHeader />
      
      <main className="h-[35%] relative flex flex-col items-center justify-center bg-gradient-to-b from-indigo-50/30 via-purple-50/20 to-white">
        <div className="absolute w-[240px] h-[240px] bg-indigo-100/30 rounded-full blur-[60px] -z-10"></div>
        <div className="relative z-10 w-[180px] h-[180px] drop-shadow-2xl animate-in fade-in zoom-in duration-500">
          {/* 使用 onboarding 场景显示角色微笑动画 */}
          <Mascot scene="onboarding" width="100%" className="drop-shadow-2xl" />
        </div>
        <div className="absolute bottom-4 w-40 h-4 bg-indigo-200/20 blur-xl rounded-[100%]"></div>
      </main>

      <div className="h-[65%] bg-white rounded-t-[48px] shadow-[0_-30px_100px_rgba(0,0,0,0.08)] p-6 z-40 overflow-hidden flex flex-col border-t border-slate-50">
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6 flex-shrink-0"></div>

        <div className="px-10 mb-6 flex-shrink-0">
          <div className="bg-slate-50 p-1 rounded-2xl flex items-center border border-slate-100 shadow-inner">
            <button 
              onClick={() => setActiveSubTab('Mine')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all duration-300 ${activeSubTab === 'Mine' ? 'bg-white shadow-md text-slate-900 scale-[1.02]' : 'text-slate-400'}`}
            >Mine</button>
            <button 
              onClick={() => setActiveSubTab('Shop')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all duration-300 ${activeSubTab === 'Shop' ? 'bg-white shadow-md text-slate-900 scale-[1.02]' : 'text-slate-400'}`}
            >Shop</button>
          </div>
        </div>

        <div className="flex gap-2.5 mb-6 overflow-x-auto no-scrollbar flex-shrink-0">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-5 py-2.5 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all duration-300 ${category === cat ? 'bg-black text-white shadow-xl scale-[1.05]' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-slate-300 text-[64px] mb-2">inventory_2</span>
              <p className="text-slate-400 font-bold">
                {activeSubTab === 'Mine' ? "You don't own any items yet" : 'No items available'}
              </p>
            </div>
          ) : (
            <div className={`grid gap-3 p-1 ${category === 'Clothes' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {items.map(item => {
                // 检查当前衣服是否正在穿着
                const isUsed = item.outfit && item.outfit === currentOutfit;
                
                return (
                  <div 
                    key={item.id}
                    onClick={() => {
                      if (activeSubTab === 'Shop') {
                        setSelectedItem(item);
                      } else if (activeSubTab === 'Mine' && item.outfit) {
                        // Mine 视图：点击衣服装备，调用后端 API
                        handleEquip(item.id, item.outfit);
                      }
                    }}
                    className={`bg-slate-50/50 rounded-[24px] p-2 border-2 flex flex-col items-center justify-center relative transition-all duration-200 cursor-pointer active:scale-95 aspect-square ${
                      item.owned ? 'border-primary/20 bg-white shadow-sm' : 'border-transparent'
                    }`}
                  >
                  {/* Mine: 显示拥有标记 */}
                  {activeSubTab === 'Mine' && item.owned && (
                    <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full shadow-lg ring-2 ring-white"></div>
                  )}
                  
                  {/* 显示商品内容 */}
                  <div className="w-full h-full flex items-center justify-center relative">
                    {/* Shop: 显示价格标签 */}
                    {activeSubTab === 'Shop' && item.price > 0 && (
                      <div className="absolute top-0 right-0 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-0.5 shadow-lg z-10">
                        <span className="material-symbols-outlined text-amber-400 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>toll</span>
                        <span className="text-[10px] font-black text-white">{item.price}</span>
                      </div>
                    )}
                    {item.outfit ? (
                      item.outfit === 'default' ? (
                        // "啥也不穿"显示 X 图标
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-300 text-[64px]">close</span>
                        </div>
                      ) : (
                        // 服装：显示服装贴图
                        <img 
                          src={`/compressed_output/cloth_processed/${item.outfit}.webp`}
                          alt={item.name}
                          className="w-full h-full object-contain drop-shadow-sm"
                        />
                      )
                    ) : item.image ? (
                      // 家具：显示家具图片
                      <img 
                        src={`/compressed_output/furniture/${item.image}`}
                        alt={item.name}
                        className="w-full h-full object-contain drop-shadow-sm"
                      />
                    ) : null}
                  </div>

                  {/* 显示 Dressed 标志（当前穿着的衣服）*/}
                  {isUsed && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-secondary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
                      Dressed
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>

      <BottomNav activeTab="game" />

      {/* 购买确认弹窗 */}
      {selectedItem && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center px-8 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 flex flex-col items-center shadow-2xl animate-in zoom-in duration-300 border border-white/20">
            <div className={`w-full bg-slate-50 rounded-[32px] flex items-center justify-center mb-8 shadow-inner border border-slate-100 overflow-hidden ${
              selectedItem.outfit ? 'aspect-square max-w-[160px]' : 'aspect-video'
            }`}>
              {selectedItem.outfit ? (
                selectedItem.outfit === 'default' ? (
                  // "啥也不穿"显示 X 图标
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-300 text-[96px]">close</span>
                  </div>
                ) : (
                  <img 
                    src={`/compressed_output/cloth_processed/${selectedItem.outfit}.webp`}
                    alt={selectedItem.name}
                    className="w-full h-full object-contain"
                  />
                )
              ) : selectedItem.image ? (
                <img 
                  src={`/compressed_output/furniture/${selectedItem.image}`}
                  alt={selectedItem.name}
                  className="w-full h-full object-contain p-4"
                />
              ) : null}
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">{selectedItem.name}</h2>
            {selectedItem.price > 0 && (
              <div className="flex items-center gap-1.5 mb-6">
                <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>toll</span>
                <span className="text-lg font-black text-amber-700">{selectedItem.price}</span>
              </div>
            )}
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (selectedItem.owned) {
                    // 已拥有：装备（调用后端 API）
                    if (selectedItem.outfit) {
                      await handleEquip(selectedItem.id, selectedItem.outfit);
                    }
                    setSelectedItem(null);
                  } else {
                    // 未拥有：购买
                    await handlePurchase(selectedItem.id);
                    setSelectedItem(null);
                  }
                }}
                disabled={isPurchasing}
                className="w-full bg-black text-white py-5 rounded-full font-black text-base shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Processing...' : (
                  selectedItem.price === 0 ? 'Equip' : (selectedItem.owned ? 'Equip' : 'Buy Now')
                )}
              </button>
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-full text-slate-400 font-bold py-4"
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutfitView;
