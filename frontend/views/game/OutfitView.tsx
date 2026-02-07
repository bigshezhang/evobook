
import React, { useState } from 'react';
import GameHeader from '../../components/GameHeader';
import BottomNav from '../../components/BottomNav';
import Mascot from '../../components/Mascot';
import { MascotOutfit, setSelectedOutfit } from '../../utils/mascotUtils';

interface Item {
  id: number;
  name: string;
  price: number;
  owned: boolean;
  outfit?: MascotOutfit;
  image?: string; // 家具图片路径
}

const OutfitView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'Mine' | 'Shop'>('Mine');
  const [category, setCategory] = useState('Clothes');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const categories = ['Clothes', 'Furniture'];

  // 服装数据
  const clothesItems: Item[] = [
    { id: 1, name: 'Dress', price: 350, owned: true, outfit: 'dress' },
    { id: 2, name: 'Glasses', price: 200, owned: false, outfit: 'glass' },
    { id: 3, name: 'Suit', price: 450, owned: false, outfit: 'suit' },
    { id: 4, name: 'Super Outfit', price: 600, owned: false, outfit: 'super' },
  ];

  // 家具数据
  const furnitureItems: Item[] = [
    { id: 101, name: 'Black Office Chair', price: 450, owned: false, image: 'black_office_chair.png' },
    { id: 102, name: 'Cherry Blossom Branch', price: 280, owned: false, image: 'cherry_blossom_branch.png' },
    { id: 103, name: 'Chinese Lantern', price: 320, owned: false, image: 'chinese_lantern_cherry_blossom.png' },
    { id: 104, name: 'Tea Table', price: 550, owned: false, image: 'chinese_low_tea_table.png' },
    { id: 105, name: 'Coat Rack', price: 200, owned: false, image: 'coat_rack.png' },
    { id: 106, name: 'Colorful Bunting', price: 150, owned: false, image: 'colorful_bunting.png' },
    { id: 107, name: 'Cute Cat', price: 800, owned: false, image: 'cute_cat.png' },
    { id: 108, name: 'Floral Screen', price: 680, owned: false, image: 'floral_screen.png' },
    { id: 109, name: 'Furry Footstool', price: 380, owned: false, image: 'furry_footstool.png' },
    { id: 110, name: 'Garden Grass', price: 120, owned: false, image: 'garden_border_grass.png' },
    { id: 111, name: 'Gift Boxes', price: 180, owned: false, image: 'gift_boxes.png' },
    { id: 112, name: 'Golden Corner', price: 420, owned: false, image: 'golden_ornamental_corner.png' },
    { id: 113, name: 'Hanging Ivy', price: 220, owned: false, image: 'hanging_ivy.png' },
    { id: 114, name: 'Holly Berries', price: 160, owned: false, image: 'holly_berries.png' },
    { id: 115, name: 'Modern Armchair', price: 520, owned: false, image: 'modern_armchair.png' },
    { id: 116, name: 'Mushroom Garden', price: 200, owned: false, image: 'mushroom_garden_border.png' },
    { id: 117, name: 'Origami Cranes', price: 280, owned: false, image: 'origami_crane_string.png' },
    { id: 118, name: 'Pink Bow Chair', price: 480, owned: false, image: 'pink_bow_chair.png' },
    { id: 119, name: 'Pink Ribbon Corner', price: 250, owned: false, image: 'pink_ribbon_corner.png' },
    { id: 120, name: 'Pink Vanity Desk', price: 720, owned: false, image: 'pink_vanity_desk.png' },
    { id: 121, name: 'Potted Plant', price: 180, owned: false, image: 'potted_plant_blue_white.png' },
    { id: 122, name: 'Rose Corner', price: 240, owned: false, image: 'rose_corner_decoration.png' },
    { id: 123, name: 'Seashells & Starfish', price: 150, owned: false, image: 'seashells_starfish.png' },
    { id: 124, name: 'Wood Side Table', price: 420, owned: false, image: 'solid_wood_side_table.png' },
    { id: 125, name: 'Square Cushion', price: 120, owned: false, image: 'square_cushion.png' },
    { id: 126, name: 'Vase with Flowers', price: 320, owned: false, image: 'vase_with_flowers.png' },
    { id: 127, name: 'Vintage Chandelier', price: 890, owned: false, image: 'vintage_chandelier.png' },
    { id: 128, name: 'Vintage Gramophone', price: 680, owned: false, image: 'vintage_gramophone.png' },
    { id: 129, name: 'Vintage Telephone', price: 450, owned: false, image: 'vintage_rotary_telephone.png' },
    { id: 130, name: 'Wicker Armchair', price: 520, owned: false, image: 'wicker_armchair.png' },
    { id: 131, name: 'Wooden Bookshelf', price: 650, owned: false, image: 'wooden_bookshelf.png' },
    { id: 132, name: 'Wooden Chair', price: 280, owned: false, image: 'wooden_chair.png' },
    { id: 133, name: 'Wooden Floor Lamp', price: 380, owned: false, image: 'wooden_floor_lamp.png' },
    { id: 134, name: 'Wooden Nightstand', price: 420, owned: false, image: 'wooden_nightstand.png' },
    { id: 135, name: 'Wooden Round Table', price: 550, owned: false, image: 'wooden_round_table.png' },
  ];

  // 根据分类获取商品列表
  const allItems = category === 'Clothes' ? clothesItems : furnitureItems;

  // 根据 Mine/Shop 标签过滤商品
  const items = activeSubTab === 'Mine' 
    ? allItems.filter(item => item.owned) 
    : allItems;

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] overflow-hidden select-none font-sans">
      <GameHeader />
      
      <main className="h-[35%] relative flex flex-col items-center justify-center bg-black">
        <div className="absolute w-[240px] h-[240px] bg-white/5 rounded-full blur-[60px] -z-10"></div>
        <div className="relative z-10 w-[180px] h-[180px] drop-shadow-2xl animate-in fade-in zoom-in duration-500">
          {/* 使用 onboarding 场景显示角色微笑动画 */}
          <Mascot scene="onboarding" width="100%" className="drop-shadow-2xl" />
        </div>
        <div className="absolute bottom-4 w-40 h-4 bg-white/5 blur-xl rounded-[100%]"></div>
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
          <div className={`grid gap-4 p-1 ${category === 'Clothes' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {items.map(item => (
              <div 
                key={item.id}
                onClick={() => activeSubTab === 'Shop' && setSelectedItem(item)}
                className={`bg-slate-50/50 rounded-[32px] p-3 border-2 flex flex-col items-center justify-center relative transition-all duration-200 ${
                  category === 'Clothes' ? 'aspect-square' : 'aspect-video'
                } ${
                  item.owned ? 'border-primary/20 bg-white shadow-sm' : 'border-transparent'
                } ${activeSubTab === 'Shop' ? 'cursor-pointer active:scale-95' : ''}`}
              >
                {item.owned && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-primary rounded-full shadow-lg ring-2 ring-white"></div>}
                
                {/* 显示商品内容 */}
                <div className="w-full h-full flex items-center justify-center">
                  {item.outfit ? (
                    // 服装：显示服装贴图
                    <img 
                      src={`/compressed_output/cloth_processed/${item.outfit}.webp`}
                      alt={item.name}
                      className="w-full h-full object-contain drop-shadow-sm"
                    />
                  ) : item.image ? (
                    // 家具：显示家具图片
                    <img 
                      src={`/compressed_output/furniture/${item.image}`}
                      alt={item.name}
                      className="w-full h-full object-contain drop-shadow-sm"
                    />
                  ) : null}
                </div>

                {item.owned && activeSubTab === 'Mine' && (
                  <span className="absolute bottom-3 text-[8px] font-black text-slate-300 uppercase tracking-widest">Owned</span>
                )}
              </div>
            ))}
          </div>
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
                <img 
                  src={`/compressed_output/cloth_processed/${selectedItem.outfit}.webp`}
                  alt={selectedItem.name}
                  className="w-full h-full object-contain"
                />
              ) : selectedItem.image ? (
                <img 
                  src={`/compressed_output/furniture/${selectedItem.image}`}
                  alt={selectedItem.name}
                  className="w-full h-full object-contain p-4"
                />
              ) : null}
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">{selectedItem.name}</h2>
            <div className="flex items-center gap-1.5 mb-6">
              <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
              <span className="text-lg font-black text-amber-700">{selectedItem.price}</span>
            </div>
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={() => {
                  // 如果是服装，保存选择并触发全局更新
                  if (selectedItem.outfit) {
                    setSelectedOutfit(selectedItem.outfit);
                  }
                  // TODO: 扣除金币和更新拥有状态的逻辑
                  setSelectedItem(null);
                }}
                className="w-full bg-black text-white py-5 rounded-full font-black text-base shadow-xl active:scale-95 transition-all"
              >
                {selectedItem.owned ? 'Already Owned' : 'Buy Now'}
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
