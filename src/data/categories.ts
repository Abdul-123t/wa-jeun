import { FoodCategory } from '../types';
export { IJEBU_ODE_AREAS } from './ijebuAreas';
import riceDishesImage from '../assets/images/category_rice_dishes_1792169660991-optimized.jpg';
import swallowSoupsImage from '../assets/images/category_swallow_soups_1792169661810-optimized.jpg';
import bukaMealsImage from '../assets/images/category_local_bukameals_1792169662615-optimized.jpg';
import streetFoodImage from '../assets/images/category_street_food_1792174171995-optimized.jpg';
import grillsImage from '../assets/images/category_grills_shawarma_1792169662635-optimized.jpg';
import fastFoodImage from '../assets/images/category_fast_food_1792174171687-optimized.jpg';
import snacksImage from '../assets/images/category_snacks_pastries_1792174173242-optimized.jpg';
import drinksImage from '../assets/images/category_drinks_beverages_1792174172917-optimized.jpg';

export const FOOD_CATEGORIES: FoodCategory[] = [
  {
    id: 'rice-dishes',
    name: 'Rice Dishes',
    description: 'Jollof rice, fried rice, Ofada rice, and delicious rice combinations.',
    image: riceDishesImage,
    popularItems: ['Jollof Rice & Dodo', 'Fried Rice with Chicken', 'Ofada Rice & Ayamase', 'Native Concoction Rice']
  },
  {
    id: 'swallow-soups',
    name: 'Swallow and Soups',
    description: 'Amala, eba, pounded yam, fufu, and traditional Nigerian soups.',
    image: swallowSoupsImage,
    popularItems: ['Amala with Ewedu & Gbegiri', 'Pounded Yam & Egusi', 'Eba with Efo Riro', 'Fufu & Ogbono Soup']
  },
  {
    id: 'buka-meals',
    name: 'Buka Meals',
    description: 'Familiar local meals, traditional stews, beans, and everyday Nigerian favorites.',
    image: bukaMealsImage,
    popularItems: ['Ofada Rice with Ayamase', 'Ewa Agoyin & Fried Plantain', 'Assorted Meat Buka Stew', 'Catfish Pepper Soup']
  },
  {
    id: 'street-food',
    name: 'Street Food',
    description: 'Akara, boli, roasted corn, suya, roasted yam, and other street-side favorites.',
    image: streetFoodImage,
    popularItems: ['Hot Golden Akara', 'Boli (Roasted Plantain) & Groundnuts', 'Roasted Sweet Corn', 'Street Suya & Roasted Yam']
  },
  {
    id: 'grills-shawarma',
    name: 'Grills and Shawarma',
    description: 'Grilled chicken, suya, shawarma wraps, kebabs, and grilled meat.',
    image: grillsImage,
    popularItems: ['Beef Suya with Yaji', 'Peppered Grilled Chicken', 'Toasted Shawarma Wraps', 'Grilled Croaker Fish']
  },
  {
    id: 'fast-food',
    name: 'Fast Food',
    description: 'Burgers, crispy fried chicken, chips, stir-fried noodles, and other quick meals.',
    image: fastFoodImage,
    popularItems: ['Juicy Beef Burgers', 'Crispy Fried Chicken', 'Hot Golden Chips / Fries', 'Stir-fried Noodles']
  },
  {
    id: 'snacks-pastries',
    name: 'Snacks and Pastries',
    description: 'Meat pies, sausage rolls, puff-puff, scotch eggs, and freshly baked treats.',
    image: snacksImage,
    popularItems: ['Flaky Meat Pies', 'Sausage Rolls', 'Sweet Round Puff-Puff', 'Scotch Eggs & Chin-Chin']
  },
  {
    id: 'drinks-beverages',
    name: 'Drinks and Beverages',
    description: 'Zobo, kunu, chilled juice, smoothies, malt drinks, and refreshing beverages.',
    image: drinksImage,
    popularItems: ['Chilled Hibiscus Zobo', 'Creamy Fresh Kunu', 'Chilled Fruit Juices', 'Cold Bottled Malt']
  }
];
