from datasets import load_dataset


def main():
    dataset = load_dataset(
        "mohanty/PlantVillage",
        "color",
        cache_dir="./2.Model/Data/hf_cache",
    )
    dataset.save_to_disk("./2.Model/Data/PlantVillage")
    print(dataset)


if __name__ == "__main__":
    main()

