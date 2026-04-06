import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { categoryApi, collectionApi } from '../api';

interface CategorySelectorProps {
  value?: string[];
  onChange?: (categories: string[]) => void;
  multiple?: boolean;
  allowCreate?: boolean;
  placeholder?: string;
}

export default function CategorySelector({
  value = [],
  onChange,
  multiple = false,
  allowCreate = false,
  placeholder = '选择分类（可输入新建）'
}: CategorySelectorProps) {
  // 获取系统分类
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAll()
  });

  // 获取自定义分类
  const { data: customCategoriesData } = useQuery({
    queryKey: ['custom-categories'],
    queryFn: () => collectionApi.getAllCategories()
  });

  const systemCategories = Array.isArray(categoriesData?.data?.data) ? categoriesData.data.data : [];
  const customCategories = Array.isArray(customCategoriesData?.data?.data) ? customCategoriesData.data.data : [];

  // 合并系统分类和自定义分类，去重
  const allCategoryNames = [...new Set([
    ...systemCategories.map((c: any) => c.name),
    ...customCategories
  ])];

  const options = allCategoryNames.map(name => ({
    label: name,
    value: name
  }));

  return (
    <Select
      mode="tags"
      placeholder={placeholder}
      value={value}
      onChange={(values) => onChange?.(Array.isArray(values) ? values : [values])}
      options={options}
      style={{ width: '100%' }}
      showSearch
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      tokenSeparators={[',', ' ']}
      maxTagCount="responsive"
    />
  );
}
